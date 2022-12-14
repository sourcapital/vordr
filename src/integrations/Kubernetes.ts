import _ from 'underscore'
import numeral from 'numeral'
import * as Stream from 'stream'
import k8s, {Exec, KubeConfig} from '@kubernetes/client-node'
import {config} from '../config.js'
import {Cron} from '../helpers/Cron.js'
import {IncidentType} from './BetterUptime.js'
import {handleError} from '../helpers/Error.js'

declare type K8sPod = {
    name: string,
    namespace: string,
    container: Container,
    restarts: number
}

enum Container {
    Bifrost = 'bifrost',
    Gateway = 'gateway',
    Thornode = 'thornode',
    Binance = 'binance-daemon',
    Bitcoin = 'bitcoin-daemon',
    Ethereum = 'ethereum-daemon',
    Litecoin = 'litecoin-daemon',
    BitcoinCash = 'bitcoin-cash-daemon',
    Dogecoin = 'dogecoin-daemon',
    Cosmos = 'gaia-daemon',
    Avalanche = 'avalanche-daemon'
}

const getContainerName = (container: string | Container): string => {
    return Object.entries(Container).find(([, val]) => val === container)?.[0]!
}

export class Kubernetes {
    private readonly k8sConfig: KubeConfig
    private readonly k8sApi: k8s.CoreV1Api

    constructor() {
        this.k8sConfig = new k8s.KubeConfig()

        if (config.nodeENV === 'production') {
            this.k8sConfig.loadFromCluster()
        } else {
            this.k8sConfig.loadFromDefault()
        }

        this.k8sApi = this.k8sConfig.makeApiClient(k8s.CoreV1Api)
    }

    async setupRestartMonitoring(schedule: string) {
        await log.info(`${Kubernetes.name}: Setup pod restart monitoring ...`)

        new Cron(schedule, async () => {
            const pods = await this.getPods('thornode')
            await Promise.all(_.map(pods, (pod) => {
                return this.monitorRestarts(pod)
            }))
        }).run()
    }

    async setupDiskUsageMonitoring(schedule: string) {
        await log.info(`${Kubernetes.name}: Setup pod disk usage monitoring ...`)

        new Cron(schedule, async () => {
            const pods = await this.getPods('thornode')
            await Promise.all(_.map(pods, (pod) => {
                return this.monitorDiskUsage(pod)
            }))
        }).run()
    }

    async setupLogStreams() {
        await log.info(`${Kubernetes.name}: Setup log streams ...`)

        try {
            const pods = await this.getPods('thornode')
            await Promise.all(_.map(pods, (pod) => {
                return this.streamLogs(pod)
            }))
        } catch (error) {
            await handleError(error)
        }
    }

    async getThornodeAddress(): Promise<string> {
        const pods = await this.getPods('thornode')
        const pod = _.find(pods, (pod) => {
            return pod.container === Container.Thornode
        })!

        return await kubernetes.execute(pod, [
            '/bin/sh',
            '-c',
            'echo "$SIGNER_PASSWD" | thornode keys show "$SIGNER_NAME" -a --keyring-backend file'
        ])
    }

    private async monitorRestarts(pod: K8sPod) {
        await log.info(`${Kubernetes.name}:${getContainerName(pod.container)}:Pod:Restarts: ${pod.restarts}`)

        // Alert for any restarts
        if (pod.restarts > 0) {
            await betterUptime.createRestartIncident(getContainerName(pod.container), pod.restarts)
        } else {
            await betterUptime.resolveIncidents(getContainerName(pod.container), IncidentType.RESTART)
        }
    }

    private async monitorDiskUsage(pod: K8sPod) {
        // Calculate pod disk usage
        const output = await this.execute(pod, ['/bin/sh', '-c', 'df -k'])
        const regex = new RegExp(`([0-9]+) ([0-9]+) [0-9]+ [0-9]+% ${this.getContainerMountPath(pod.container)}`)
        const matches = regex.exec(output)!
        const totalBytes = Number(matches[1]) * 1024 // KiloBytes to bytes
        const usedBytes = Number(matches[2]) * 1024 // KiloBytes to bytes
        const diskUsage = usedBytes / totalBytes
        await log.info(`${Kubernetes.name}:${getContainerName(pod.container)}:Pod:DiskUsage: ${numeral(usedBytes).format('0.0b')} / ${numeral(totalBytes).format('0.0b')} (${numeral(diskUsage).format('0.00%')})`)

        // Alert if disk usage is above 85%
        if (diskUsage > 0.85) {
            await betterUptime.createDiskUsageIncident(getContainerName(pod.container), usedBytes, totalBytes, 0.85)
        } else {
            await betterUptime.resolveIncidents(getContainerName(pod.container), IncidentType.DISK_USAGE)
        }
    }

    private async streamLogs(pod: K8sPod) {
        const logStream = new Stream.PassThrough()
        const prefix = `${Kubernetes.name}:${getContainerName(pod.container)}:Logs`

        logStream.on('data', async (chunk) => {
            let message = chunk.toString()
                .replaceAll(/\s+/g, ' ')
                .replaceAll('\n', '')
                .trim()

            const logLevel = await this.parseLogLevel(message)

            try {
                // Check if message is a json
                JSON.parse(message)
                // Stringify the message
                message = JSON.stringify(message)
            } catch {
                // Message is not a json, do nothing
            }

            switch (logLevel) {
                case 'debug':
                    await log.debug(`${prefix}: ${message}`)
                    break
                case 'info':
                    await log.info(`${prefix}: ${message}`)
                    break
                case 'warn':
                    await log.warn(`${prefix}: ${message}`)
                    break
                case 'error':
                    await log.error(`${prefix}: ${message}`)
                    break
            }
        })

        logStream.on('close', async () => {
            await log.debug(`${prefix}:stream: Closed!`)
            await log.debug(`${prefix}:stream: Reconnecting ...`)
            await this.streamLogs(pod)
        })

        logStream.on('error', async (error) => {
            await log.error(`${prefix}:stream: Error!`)
            await handleError(error)
        })

        const k8sLog = new k8s.Log(this.k8sConfig)
        await k8sLog.log(pod.namespace, pod.name, pod.container, logStream, {
            follow: true,
            tailLines: 1,
            pretty: false,
            timestamps: false
        })
    }

    private async getPods(namespace: string): Promise<Array<K8sPod>> {
        const response = await this.k8sApi.listNamespacedPod(namespace)

        return _.map(response.body.items, (pod) => {
            return {
                name: pod.metadata!.name!,
                namespace: namespace,
                container: pod.metadata!.labels!['app.kubernetes.io/name'] as Container,
                restarts: _.reduce(_.map(pod.status!.containerStatuses!, (status) => {
                    return status.restartCount
                }), (a, b) => {
                    return a + b
                }) ?? 0
            }
        })
    }

    private async execute(pod: K8sPod, command: string | string[]): Promise<string> {
        const exec = new Exec(this.k8sConfig)

        return new Promise<string>(async (resolve, reject) => {
            const dataStream = new Stream.PassThrough()
            const errorStream = new Stream.PassThrough()

            let dataString = ''

            dataStream.on('data', async (chunk) => {
                dataString += chunk.toString()
            })

            dataStream.on('close', async () => {
                dataString = dataString.replaceAll(/\s+/g, ' ').trim()
                resolve(dataString)
            })

            errorStream.on('data', async (chunk) => {
                const errorString = chunk.toString()
                await log.error(`${Kubernetes.name}:${getContainerName(pod.container)}:${this.execute.name}:error-stream: ${errorString}`)
                reject(errorString)
            })

            await exec.exec(
                pod.namespace,
                pod.name,
                pod.container,
                command,
                dataStream as Stream.Writable,
                errorStream as Stream.Writable,
                null,
                false
            )
        })
    }

    private getContainerMountPath(container: Container): string {
        let mountPath: string

        switch (container) {
            case Container.Bifrost:
                mountPath = '/var/data/bifrost'
                break
            case Container.Gateway:
                mountPath = '/etc/hosts'
                break
            case Container.Thornode:
            case Container.Ethereum:
                mountPath = '/root'
                break
            case Container.Binance:
                mountPath = '/opt/bnbchaind'
                break
            case Container.Bitcoin:
            case Container.BitcoinCash:
                mountPath = '/home/bitcoin/.bitcoin'
                break
            case Container.Litecoin:
                mountPath = '/home/litecoin/.litecoin'
                break
            case Container.Dogecoin:
                mountPath = '/home/dogecoin/.dogecoin'
                break
            case Container.Cosmos:
                mountPath = '/root/.gaia'
                break
            case Container.Avalanche:
                mountPath = '/root/.avalanchego'
                break
        }

        return mountPath
    }

    private async parseLogLevel(message: string): Promise<string> {
        message = message.toLowerCase()

        const regex1 = /(debug|info|warn|error)/g.exec(message)
        const regex2 = /([diwe])[a-z]*\s*\[/.exec(message)

        let logLevel: string
        if (regex1) {
            logLevel = regex1.slice(1, 2)[0]
        } else if (regex2) {
            logLevel = regex2.slice(1, 2)[0]
        } else {
            logLevel = 'none'
        }

        switch (logLevel) {
            case 'd':
            case 'debug':
                logLevel = 'debug'
                break
            case 'i':
            case 'info':
                logLevel = 'info'
                break
            case 'w':
            case 'warn':
            case 'warning':
                logLevel = 'warn'
                break
            case 'e':
            case 'error':
                logLevel = 'error'
                break
            default:
                logLevel = 'info'
                break
        }

        return logLevel
    }
}