import _ from 'underscore'
import * as Stream from 'stream'
import k8s, {KubeConfig} from '@kubernetes/client-node'
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

    private async monitorRestarts(pod: K8sPod) {
        await log.info(`${Kubernetes.name}:${getContainerName(pod.container)}:Pod:Restarts: ${pod.restarts}`)

        // Alert for any restarts
        if (pod.restarts > 0) {
            await betterUptime.createRestartIncident(getContainerName(pod.container), pod.restarts)
        } else {
            await betterUptime.resolveIncidents(getContainerName(pod.container), IncidentType.RESTART)
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