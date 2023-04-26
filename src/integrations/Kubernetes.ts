import _ from 'underscore'
import k8s, {KubeConfig} from '@kubernetes/client-node'
import {config} from '../config.js'
import {Cron} from '../helpers/Cron.js'
import {IncidentType} from './BetterUptime.js'

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

export const getContainerName = (container: string | Container): string => {
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
        if (config.nodeENV !== 'production') return

        await log.info(`${Kubernetes.name}: Setup pod restart monitoring ...`)

        new Cron(schedule, async () => {
            const pods = await this.getPods('thornode')
            await Promise.all(_.map(pods, (pod) => {
                return this.monitorRestarts(pod)
            }))
        }).run()
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
}