import _ from 'underscore'
import moment from 'moment'
import {config} from '../config.js'
import {Chain, Cosmos} from './Cosmos.js'
import {safeAxiosGet} from '../helpers/Axios.js'
import {HeartbeatType, IncidentType} from '../integrations/BetterStack.js'

export class Thornode extends Cosmos {
    private readonly thorRpcUrl: string

    constructor(thorUrl: string, cosmosUrl: string) {
        super(cosmosUrl, Chain.Thorchain)
        this.thorRpcUrl = thorUrl
    }

    async initHeartbeats() {
        await betterStack.initHeartbeats(Thornode.name, [
            HeartbeatType.HEALTH,
            HeartbeatType.VERSION
        ])
        await super.initHeartbeats()
    }

    async isUp(): Promise<boolean> {
        await log.debug(`${Thornode.name}: Checking if the node is up ...`)

        const nodeResponse = await safeAxiosGet(`${this.thorRpcUrl}/thorchain/ping`)

        if (nodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.isUp.name}: Node HTTP status code: ${nodeResponse?.status}`)
            return false
        }

        const pong = nodeResponse.data.ping
        await log.debug(`${Thornode.name}:${this.isUp.name}: ping -> ${pong}`)

        if (pong !== 'pong') {
            await log.error(`${Thornode.name}:${this.isUp.name}: Node does not respond to 'ping' with 'pong'!`)
            return false
        }

        await log.info(`${Thornode.name}: Node is up!`)
        await betterStack.sendHeartbeat(Thornode.name, HeartbeatType.HEALTH)

        return await super.isUp()
    }

    async monitorVersion() {
        await log.debug(`${Thornode.name}: Checking if node version is up-to-date ...`)

        const nodeResponse = await safeAxiosGet(`${this.thorRpcUrl}/thorchain/nodes`)

        if (nodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.monitorVersion.name}: Node HTTP status code: ${nodeResponse?.status}`)
            return
        }

        const nodeAddress = this.getAddress()
        const node = _.find(nodeResponse.data, (node) => {
            return node.node_address === nodeAddress
        })

        if (!node) {
            await log.info(`${Thornode.name}:${this.monitorVersion.name}: Node '${nodeAddress}' not bonded!`)
            return
        }

        // Get the node's version
        const nodeVersion = node.version

        // Get the top version of the active nodes
        const topVersion = _.max(_.map(_.filter(nodeResponse.data, (node) => {
            return node.status.toLowerCase() === 'active'
        }), (node) => {
            return node.version
        }), (version) => {
            return Number(version.replace(/\./g, ''))
        })
        await log.debug(`${Thornode.name}:${this.monitorVersion.name}: topVersion = ${topVersion}`)

        // Parse version as numbers so they can be compared
        const nodeVersionAsNumber = Number(/([0-9]+)\.([0-9]+)\.([0-9]+)/g.exec(nodeVersion)!.slice(1, 4).join(''))
        const topVersionAsNumber = Number(/([0-9]+)\.([0-9]+)\.([0-9]+)/g.exec(topVersion)!.slice(1, 4).join(''))

        if (nodeVersionAsNumber < topVersionAsNumber) {
            await log.warn(`${Thornode.name}:${this.monitorVersion.name}: nodeVersion < topVersion: '${nodeVersion}' < '${topVersion}'`)
            return
        }

        await log.info(`${Thornode.name}: Node version is up-to-date!`)
        await betterStack.sendHeartbeat(Thornode.name, HeartbeatType.VERSION)
    }

    async monitorBond() {
        await log.debug(`${Thornode.name}: Monitoring bond ...`)

        const nodeResponse = await safeAxiosGet(`${this.thorRpcUrl}/thorchain/nodes`)

        if (nodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.monitorBond.name}: Node HTTP status code: ${nodeResponse?.status}`)
            return
        }

        const nodeAddress = this.getAddress()
        const node = _.find(_.map(nodeResponse.data, (node) => {
            return { // Map relevant node values
                address: node.node_address,
                bond: Number(node.total_bond / 1e8),
                reward: Number(node.current_award / 1e8)
            }
        }), (node) => {
            return node.address === nodeAddress // Find node by address
        })

        if (!node) {
            await log.warn(`${Thornode.name}:${this.monitorBond.name}: Node '${nodeAddress}' not bonded!`)
            return
        }

        const activeNodes = _.sortBy(_.map(_.filter(nodeResponse.data, (node) => {
            return node.status.toLowerCase() === 'active' // Include active nodes only
        }), (node) => {
            return {address: node.node_address, bond: Number(node.total_bond / 1e8)} // Map relevant node values
        }), (node) => {
            return node.bond // Sort by bond (ascending)
        })

        const bottomTwoThirdActiveNodes = activeNodes.slice(0, Math.floor(activeNodes.length * 2 / 3))
        const nodeWithHighestBondInTheBottomTwoThirds = bottomTwoThirdActiveNodes[bottomTwoThirdActiveNodes.length - 1]
        const maxEfficientBond = nodeWithHighestBondInTheBottomTwoThirds.bond

        await log.info(`${Thornode.name}:Bond: bond = ${Math.round(node.bond)}; reward = ${Math.round(node.reward)}; maxEfficientBond = ${Math.round(maxEfficientBond)}`)
    }

    async monitorSlashPoints() {
        await log.debug(`${Thornode.name}: Monitoring slash points ...`)

        const nodeResponse = await safeAxiosGet(`${this.thorRpcUrl}/thorchain/nodes`)

        if (nodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.monitorSlashPoints.name}: Node HTTP status code: ${nodeResponse?.status}`)
            return
        }

        const activeNodes = _.sortBy(_.map(_.filter(nodeResponse.data, (node) => {
            return node.status.toLowerCase() === 'active' // Include active nodes only
        }), (node) => {
            return {address: node.node_address, slashPoints: Number(node.slash_points)} // Map relevant node values
        }), (node) => {
            return node.slashPoints // Sort by bond (descending)
        }).reverse()

        const nodeAddress = this.getAddress()
        const node = _.find(activeNodes, (node) => {
            return node.address === nodeAddress
        })

        if (!node) {
            await log.warn(`${Thornode.name}:${this.monitorSlashPoints.name}: Node is not active. Skipping slash points monitoring ...`)
            return
        }

        // Calculate min, max and worst-top-10 threshold
        const min = activeNodes[activeNodes.length - 1].slashPoints
        const max = activeNodes[0].slashPoints
        const worstTop10Threshold = activeNodes[Math.floor(activeNodes.length / 10)].slashPoints

        // Calculate average
        const sum = _.reduce(activeNodes, (total, node) => total + node.slashPoints, 0)
        const average = sum / activeNodes.length

        // Calculate median
        const mid = Math.floor(activeNodes.length / 2)
        const median = activeNodes.length % 2 === 0 ? (activeNodes[mid - 1].slashPoints + activeNodes[mid].slashPoints) / 2 : activeNodes[mid].slashPoints

        await log.info(`${Thornode.name}:SlashPoints: node = ${Math.round(node.slashPoints)}; network = ${Math.round(min)} (min), ${Math.round(median)} (median), ${Math.round(average)} (average), ${Math.round(worstTop10Threshold)} (worstTop10Threshold), ${Math.round(max)} (max)`)

        // Alert if node enters the worst-top-10 and has over 500 slash points
        if (node.slashPoints > worstTop10Threshold && node.slashPoints > 500) {
            await betterStack.createSlashPointIncident(Thornode.name, node.slashPoints, worstTop10Threshold)
        } else {
            await betterStack.resolveIncidents(Thornode.name, IncidentType.SLASH_POINTS)
        }
    }

    async monitorJailing() {
        await log.debug(`${Thornode.name}: Checking if node has been jailed ...`)

        const nodeAddress = this.getAddress()

        // Await all time critical request together to minimize any delay (e.g. difference in block height)
        const [thorRpcNodeResponse, cosmosRpcNodeResponse] = await Promise.all([
            safeAxiosGet(`${this.thorRpcUrl}/thorchain/node/${nodeAddress}`),
            safeAxiosGet(`${this.url}/status`)
        ])

        if (thorRpcNodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.monitorJailing.name}: ThorRpc HTTP status code: ${thorRpcNodeResponse?.status}`)
            return
        }
        if (cosmosRpcNodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.monitorJailing.name}: CosmosRpc HTTP status code: ${cosmosRpcNodeResponse?.status}`)
            return
        }

        const status = thorRpcNodeResponse.data.status.toLowerCase()
        const jail = thorRpcNodeResponse.data.jail

        if (status !== 'active') {
            await log.warn(`${Thornode.name}:${this.monitorJailing.name}: Node is not active. Skipping jail monitoring ...`)
            return
        }
        if (!jail.release_height) {
            await log.warn(`${Thornode.name}:${this.monitorJailing.name}: Node is not jailed. Skipping jail monitoring ...`)
            return
        }

        const releaseHeight = jail.release_height
        const currentHeight = Number(cosmosRpcNodeResponse.data.result.sync_info.latest_block_height)

        // Alert if node is jailed
        if (releaseHeight > currentHeight) {
            const reason = jail.reason ?? 'unknown'
            const diff = releaseHeight - currentHeight
            await log.info(`${Thornode.name}:Jail: Node is jailed for ${diff} blocks! (until = ${releaseHeight}, reason = '${reason}')`)

            await betterStack.createJailIncident(Thornode.name, currentHeight, releaseHeight)
        } else {
            await betterStack.resolveIncidents(Thornode.name, IncidentType.JAIL)
        }
    }

    async monitorChainObservations() {
        await log.debug(`${Thornode.name}: Monitoring chain observations ...`)

        const nodeResponse = await safeAxiosGet(`${this.thorRpcUrl}/thorchain/nodes`)

        if (nodeResponse?.status !== 200) {
            await log.error(`${Thornode.name}:${this.monitorChainObservations.name}: Node HTTP status code: ${nodeResponse?.status}`)
            return
        }

        const activeNodes = _.map(_.filter(nodeResponse.data, (node) => {
            return node.status.toLowerCase() === 'active' // Include active nodes only
        }), (node) => {
            return {address: node.node_address, observedChains: node.observe_chains} // Map relevant node values
        })

        const nodeAddress = this.getAddress()
        const node = _.find(activeNodes, (node) => {
            return node.address === nodeAddress
        })

        if (!node) {
            await log.warn(`${Thornode.name}:${this.monitorChainObservations.name}: Node is not active. Skipping chain observation monitoring ...`)
            return
        }

        for (const observedChain of node.observedChains) {
            const chain = observedChain.chain.toUpperCase()
            const observedHeight = observedChain.height

            const latestObservedHeightsByActiveNodes = _.map(activeNodes, (node) => {
                return _.find(node.observedChains, (observedChain) => {
                    return observedChain.chain.toUpperCase() === chain
                })?.height ?? -1 // Could be undefined for newer nodes that haven't observed previous chains (e.g. Terra)
            })
            const latestObservedHeightsByCount = _.countBy(latestObservedHeightsByActiveNodes, (latestObservedHeight) => {
                return latestObservedHeight
            })
            const latestObservedHeightConsensus = Number(_.max(_.keys(latestObservedHeightsByCount), (key) => {
                return latestObservedHeightsByCount[key]
            }))

            // Alert if node is behind on chain observations only every 10 minutes, but resolve every minute
            if (observedHeight < latestObservedHeightConsensus && moment().minutes() % 10 === 0) {
                const diff = latestObservedHeightConsensus - observedHeight
                await log.info(`${Thornode.name}:ChainObservation: ${chain} is ${diff} blocks behind the majority observation of the network! (observedHeight = ${observedHeight}, latestObservedHeightConsensus = ${latestObservedHeightConsensus})`)

                await betterStack.createChainObservationIncident(chain, diff)
            } else {
                await betterStack.resolveIncidents(chain, IncidentType.CHAIN_OBSERVATION)
            }
        }
    }

    private getAddress(): string {
        return config.thornodeAddress!
    }
}
