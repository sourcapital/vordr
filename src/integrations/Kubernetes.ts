import _ from 'underscore'
import moment from 'moment'
import k8s, {KubeConfig} from '@kubernetes/client-node'
import {config} from '../config.js'
import {Cron} from '../helpers/Cron.js'
import {IncidentType} from './BetterStack.js'

export declare type K8sPod = {
    name: string,
    namespace: string,
    container: Container,
    restarts: number,
    restartReason: string | undefined,
    lastRestartTime: moment.Moment | undefined
}

enum Container {
    Vordr = 'vordr',
    Bifrost = 'bifrost',
    Gateway = 'gateway',
    Thornode = 'thornode',
    Bitcoin = 'bitcoin-daemon',
    Ethereum = 'ethereum-daemon',
    Litecoin = 'litecoin-daemon',
    BitcoinCash = 'bitcoin-cash-daemon',
    Dogecoin = 'dogecoin-daemon',
    Cosmos = 'gaia-daemon',
    Avalanche = 'avalanche-daemon',
    BinanceSmart = 'binance-smart-daemon'
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
            this.k8sConfig.loadFromDefault()
        } else {
            this.k8sConfig.loadFromDefault()
        }

        this.k8sApi = this.k8sConfig.makeApiClient(k8s.CoreV1Api)
    }

    async setupRestartMonitoring(schedule: string) {
        if (config.nodeENV !== 'production') return

        await log.info('Setup k8s pod restart monitoring ...')

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
            // Resolve previous restart incidents
            await global.betterStack?.resolveIncidents(getContainerName(pod.container), IncidentType.RESTART)

            // Create new restart incident
            await global.betterStack?.createRestartIncident(getContainerName(pod.container), pod)
        }
    }

    private async getPods(namespace: string): Promise<Array<K8sPod>> {
        const response = await this.k8sApi.listNamespacedPod(namespace)

        return _.map(response.body.items, (pod) => {
            const containerStatus = pod.status!.containerStatuses![0]

            return {
                name: pod.metadata!.name!,
                namespace: namespace,
                container: pod.metadata!.labels!['app.kubernetes.io/name'] as Container,
                restarts: containerStatus.restartCount,
                restartReason: containerStatus.lastState!.terminated?.reason,
                lastRestartTime: containerStatus.lastState!.terminated?.finishedAt ? moment(containerStatus.lastState!.terminated?.finishedAt) : undefined
            }
        })
    }
}
