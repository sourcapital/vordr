import _ from 'underscore'
import numeral from 'numeral'
import k8s, {Exec, KubeConfig} from '@kubernetes/client-node'
import {config} from '../config.js'
import {handleError} from './Error.js'
import {Cron} from './Cron.js'
import * as Stream from 'stream'
import {Node} from '../chains/Node.js'
import {Thornode} from '../chains/Thornode.js'
import {Binance} from '../chains/Binance.js'
import {Bitcoin} from '../chains/Bitcoin.js'
import {Ethereum} from '../chains/Ethereum.js'
import {Litecoin} from '../chains/Litecoin.js'
import {BitcoinCash} from '../chains/BitcoinCash.js'
import {Dogecoin} from '../chains/Dogecoin.js'
import {Cosmos} from '../chains/Cosmos.js'
import {Avalanche} from '../chains/Avalanche.js'

declare type K8sPod = {
    name: string,
    namespace: string,
    container: string,
    restarts: number
}

enum Container {
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

    async setupRestartMonitoring(nodes: Array<Node>) {
        await log.info(`${Kubernetes.name}: Setup pod restart monitoring ...`)

        // Run every 5 minutes
        new Cron('*/5 * * * *', async () => {
            await Promise.all(_.map(nodes, (node) => {
                return this.monitorRestarts(this.getContainerFromNodeClass(node), 'thornode')
            }))
        }).run()
    }

    async setupDiskUsageMonitoring(nodes: Array<Node>) {
        await log.info(`${Kubernetes.name}: Setup pod disk usage monitoring ...`)

        // Run every hour
        new Cron('0 * * * *', async () => {
            await Promise.all(_.map(nodes, (node) => {
                return this.monitorDiskUsage(this.getContainerFromNodeClass(node), 'thornode')
            }))
        }).run()
    }

    async setupLogStreams(nodes: Array<Node>) {
        await log.info(`${Kubernetes.name}: Setup log streams ...`)

        try {
            const jobs = _.map(nodes, (node) => {
                return this.streamLogs(this.getContainerFromNodeClass(node), 'thornode')
            })
            await Promise.all(jobs)
        } catch (error) {
            await handleError(error)
        }
    }

    private async monitorRestarts(container: Container, namespace: string) {
        const pod = await this.getPodByContainer(container, namespace)

        if (!pod) {
            await log.error(`${Kubernetes.name}:${getContainerName(container)}:${this.monitorRestarts.name}: Pod for container '${container}' not found in cluster namespace '${namespace}'!`)
            return
        }

        await log.info(`${Kubernetes.name}:${getContainerName(container)}:${this.monitorRestarts.name}: restarts = ${pod.restarts}`)
    }

    private async monitorDiskUsage(container: Container, namespace: string) {
        const pod = await this.getPodByContainer(container, namespace)

        if (!pod) {
            await log.error(`${Kubernetes.name}:${getContainerName(container)}:${this.monitorDiskUsage.name}: Pod for container '${container}' not found in cluster namespace '${namespace}'!`)
            return
        }

        // Calculate pod disk usage
        const output = await this.execute(pod, ['df', '-k'])
        const regex = new RegExp(`([0-9]+) ([0-9]+) [0-9]+ [0-9]+% ${this.getContainerMountPath(container)}`)
        const matches = regex.exec(output!.replaceAll(/\s+/g, ' '))!
        const totalBytes = Number(matches[1]) * 1024 // KiloBytes to bytes
        const usedBytes = Number(matches[2]) * 1024 // KiloBytes to bytes
        const diskUsage = usedBytes / totalBytes

        await log.info(`${Kubernetes.name}:${getContainerName(container)}:${this.monitorDiskUsage.name}: diskUsage = ${numeral(usedBytes).format('0.0b')} / ${numeral(totalBytes).format('0.0b')} (${numeral(diskUsage).format('0.00%')})`)
    }

    private async streamLogs(container: Container, namespace: string) {
        const pod = await this.getPodByContainer(container, namespace)

        if (!pod) {
            await log.error(`${Kubernetes.name}:${getContainerName(container)}:${this.streamLogs.name}: Pod for container '${container}' not found in cluster namespace '${namespace}'!`)
            return
        }

        const logStream = new Stream.PassThrough()
        logStream.on('data', async (chunk) => {
            const message = chunk.toString()
                .replaceAll(/\s+/g, ' ')
                .replaceAll('\n', '')
                .trim()

            const prefix = `${Kubernetes.name}:${getContainerName(container)}:Logs`
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
                container: pod.metadata!.labels!['app.kubernetes.io/name'],
                restarts: _.reduce(_.map(pod.status!.containerStatuses!, (status) => {
                    return status.restartCount
                }), (a, b) => {
                    return a + b
                }) ?? 0
            }
        })
    }

    private async getPodByContainer(container: Container, namespace: string): Promise<K8sPod | undefined> {
        const pods = await this.getPods(namespace)

        return _.find(pods, (pod) => {
            return pod.container === container
        })
    }

    private async execute(pod: K8sPod, command: string | string[]): Promise<string> {
        const exec = new Exec(this.k8sConfig)

        return new Promise<string>(async (resolve, reject) => {
            const dataStream = new Stream.PassThrough()
            const errorStream = new Stream.PassThrough()

            dataStream.on('data', async (chunk) => {
                const dataString = chunk.toString()
                // await log.debug(`${Kubernetes.name}:${getContainerName(pod.container)}:${this.execute.name}:data-stream: ${dataString}`)
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

    private getContainerFromNodeClass(node: Node): Container {
        let container: Container

        switch (node.constructor.name) {
            case Thornode.name:
                container = Container.Thornode
                break
            case Binance.name:
                container = Container.Binance
                break
            case Bitcoin.name:
                container = Container.BitcoinCash
                break
            case Ethereum.name:
                container = Container.Ethereum
                break
            case Litecoin.name:
                container = Container.Litecoin
                break
            case BitcoinCash.name:
                container = Container.BitcoinCash
                break
            case Dogecoin.name:
                container = Container.Dogecoin
                break
            case Cosmos.name:
                container = Container.Cosmos
                break
            case Avalanche.name:
                container = Container.Avalanche
                break
            default:
                throw new Error(`${Kubernetes.name}:${this.getContainerFromNodeClass.name}: Unknown Node class: '${node.constructor.name}'`)
        }

        return container
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