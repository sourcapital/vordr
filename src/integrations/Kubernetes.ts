import _ from 'underscore'
import numeral from 'numeral'
import * as Stream from 'stream'
import k8s, {Exec, KubeConfig} from '@kubernetes/client-node'
import {config} from '../config.js'
import {handleError} from '../helpers/Error.js'
import {Cron} from '../helpers/Cron.js'

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

    async setupRestartMonitoring(namespace: string) {
        await log.info(`${Kubernetes.name}: Setup pod restart monitoring ...`)

        // Run every 5 minutes
        new Cron('*/5 * * * *', async () => {
            const pods = await this.getPods(namespace)
            await Promise.all(_.map(pods, (pod) => {
                return this.monitorRestarts(pod)
            }))
        }).run()
    }

    async setupDiskUsageMonitoring(namespace: string) {
        await log.info(`${Kubernetes.name}: Setup pod disk usage monitoring ...`)

        // Run every hour
        new Cron('0 * * * *', async () => {
            const pods = await this.getPods(namespace)
            await Promise.all(_.map(pods, (pod) => {
                return this.monitorDiskUsage(pod)
            }))
        }).run()
    }

    async setupLogStreams(namespace: string) {
        await log.info(`${Kubernetes.name}: Setup log streams ...`)

        try {
            const pods = await this.getPods(namespace)
            await Promise.all(_.map(pods, (pod) => {
                return this.streamLogs(pod)
            }))
        } catch (error) {
            await handleError(error)
        }
    }

    private async monitorRestarts(pod: K8sPod) {
        await log.info(`${Kubernetes.name}:${getContainerName(pod.container)}:Pod:Restarts: ${pod.restarts}`)
    }

    private async monitorDiskUsage(pod: K8sPod) {
        // Calculate pod disk usage
        const output = await this.execute(pod, ['df', '-k'])
        const regex = new RegExp(`([0-9]+) ([0-9]+) [0-9]+ [0-9]+% ${this.getContainerMountPath(pod.container)}`)
        const matches = regex.exec(output!.replaceAll(/\s+/g, ' '))!
        const totalBytes = Number(matches[1]) * 1024 // KiloBytes to bytes
        const usedBytes = Number(matches[2]) * 1024 // KiloBytes to bytes
        const diskUsage = usedBytes / totalBytes

        await log.info(`${Kubernetes.name}:${getContainerName(pod.container)}:Pod:DiskUsage: ${numeral(usedBytes).format('0.0b')} / ${numeral(totalBytes).format('0.0b')} (${numeral(diskUsage).format('0.00%')})`)
    }

    private async streamLogs(pod: K8sPod) {
        const logStream = new Stream.PassThrough()
        logStream.on('data', async (chunk) => {
            const message = chunk.toString()
                .replaceAll(/\s+/g, ' ')
                .replaceAll('\n', '')
                .trim()

            const prefix = `${Kubernetes.name}:${getContainerName(pod.container)}:Logs`
            const logLevel = await this.parseLogLevel(message)

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

            dataStream.on('data', async (chunk) => {
                const dataString = chunk.toString()
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