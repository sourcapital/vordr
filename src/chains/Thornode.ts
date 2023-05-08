import axios from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {config} from '../config.js'
import {Chain, Cosmos} from './Cosmos.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType, IncidentType} from '../integrations/BetterUptime.js'

export class Thornode extends Cosmos {
    private readonly thorRpcUrl: string

    constructor(thorUrl: string, cosmosUrl: string) {
        super(cosmosUrl, Chain.Thorchain)
        this.thorRpcUrl = thorUrl
    }

    async initHeartbeats() {
        await betterUptime.initHeartbeats(Thornode.name, [
            HeartbeatType.HEALTH,
            HeartbeatType.VERSION
        ])
        await super.initHeartbeats()
    }

    async isUp(): Promise<boolean> {
        await log.info(`${Thornode.name}: Checking if the node is up ...`)

        try {
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/ping`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.isUp.name}:ping: Node HTTP status code: ${nodeResponse.status}`)
                return false
            }

            const nodePong = nodeResponse.data.ping
            await log.debug(`${Thornode.name}:${this.isUp.name}: ping -> ${nodePong}`)

            if (nodePong !== 'pong') {
                await log.error(`${Thornode.name}:${this.isUp.name}:ping: Node does not respond to 'ping' with 'pong'!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Thornode.name}: Node is up!`)
        await betterUptime.sendHeartbeat(Thornode.name, HeartbeatType.HEALTH)

        return await super.isUp()
    }

    async monitorVersion() {
        await log.info(`${Thornode.name}: Checking if node version is up-to-date ...`)

        try {
            const nodeAddress = this.getAddress()
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/nodes`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.monitorVersion.name}: HTTP status code: ${nodeResponse.status}`)
                return
            }

            // Try to find the node
            const nodes = nodeResponse.data
            const node = _.find(nodes, (node) => {
                return node.node_address === nodeAddress
            })

            if (!node) {
                await log.info(`${Thornode.name}:${this.monitorVersion.name}: Node '${nodeAddress}' not bonded!`)
                return
            }

            // Get the node's version
            const nodeVersion = node.version

            // Get the top version of the active nodes
            const activeNodes = _.filter(nodes, (node) => {
                return node.status.toLowerCase() === 'active'
            })
            const versions = _.map(activeNodes, (node) => {
                return node.version
            })
            const topVersion = _.max(versions, (version) => {
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
        } catch (error) {
            await handleError(error)
            return
        }

        await log.info(`${Thornode.name}: Node version is up-to-date!`)
        await betterUptime.sendHeartbeat(Thornode.name, HeartbeatType.VERSION)
    }

    async monitorBond() {
        await log.info(`${Thornode.name}: Monitoring bond ...`)

        try {
            const nodeAddress = this.getAddress()
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/node/${nodeAddress}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.monitorBond.name}: Node HTTP status code: ${nodeResponse.status}`)
                return
            }

            const bond = Number(nodeResponse.data.total_bond) / 1e8
            const reward = Number(nodeResponse.data.current_award) / 1e8

            await log.info(`${Thornode.name}:Bond: bond = ${numeral(bond).format('0')} | reward = ${numeral(reward).format('0')}`)
        } catch (error) {
            await handleError(error)
        }
    }

    async monitorSlashPoints() {
        await log.info(`${Thornode.name}: Monitoring slash points ...`)

        try {
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/nodes`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.monitorSlashPoints.name}: Node HTTP status code: ${nodeResponse.status}`)
                return
            }

            let activeNodes = _.filter(nodeResponse.data, (node) => {
                return node.status.toLowerCase() === 'active'
            })
            activeNodes = _.map(activeNodes, (node) => {
                return {
                    address: node.node_address,
                    slashPoints: node.slash_points
                }
            })
            activeNodes = _.sortBy(activeNodes, (slashPoints) => {
                return slashPoints.slashPoints
            }).reverse()

            // Get the thornode's address
            const nodeAddress = this.getAddress()

            // Try to find the node in the active nodes
            const node = _.find(activeNodes, (node) => {
                return node.address === nodeAddress
            })

            if (!node) {
                await log.info(`${Thornode.name}:${this.monitorSlashPoints.name}: Node is not active. Skipping slash points monitoring ...`)
                return
            }

            // Calculate min, max and worst top 10 threshold
            const min = _.min(activeNodes, (node) => {
                return node.slashPoints
            }).slashPoints
            const max = _.max(activeNodes, (node) => {
                return node.slashPoints
            }).slashPoints
            const worstTop10Threshold = activeNodes[Math.floor(activeNodes.length / 10)].slashPoints

            // Calculate average
            const sum = _.reduce(activeNodes, (total, node) => total + node.slashPoints, 0)
            const average = sum / activeNodes.length

            // Calculate median
            const sortedNodes = _.sortBy(activeNodes, (node) => node.slashPoints)
            const mid = Math.floor(sortedNodes.length / 2)
            const median = sortedNodes.length % 2 === 0 ? (sortedNodes[mid - 1].slashPoints + sortedNodes[mid].slashPoints) / 2 : sortedNodes[mid].slashPoints

            await log.info(`${Thornode.name}:SlashPoints: ${numeral(node.slashPoints).format('0')} | network = ${numeral(min).format('0')} (min), ${numeral(median).format('0')} (median), ${numeral(average).format('0')} (average), ${numeral(worstTop10Threshold).format('0')} (worstTop10Threshold), ${numeral(max).format('0')} (max)`)

            // Alert if node enters the worst top 10
            if (node.slashPoints > worstTop10Threshold) {
                await betterUptime.createSlashPointIncident(Thornode.name, node.slashPoints, worstTop10Threshold)
            } else {
                await betterUptime.resolveIncidents(Thornode.name, IncidentType.SLASH_POINTS)
            }
        } catch (error) {
            await handleError(error)
        }
    }

    async monitorJailing() {
        await log.info(`${Thornode.name}: Checking if node has been jailed ...`)

        try {
            const nodeAddress = this.getAddress()

            // Await all time critical request together to minimize any delay (e.g. difference in block height)
            const [thorRpcNodeResponse, cosmosRpcNodeResponse] = await Promise.all([
                axios.get(`${this.thorRpcUrl}/thorchain/node/${nodeAddress}`),
                axios.get(`${this.url}/status`)
            ])

            if (thorRpcNodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.monitorJailing.name}: ThorRpc HTTP status code: ${thorRpcNodeResponse.status}`)
                return
            }
            if (cosmosRpcNodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.monitorJailing.name}: CosmosRpc HTTP status code: ${cosmosRpcNodeResponse.status}`)
                return
            }

            const status = thorRpcNodeResponse.data.status.toLowerCase()
            const jail = thorRpcNodeResponse.data.jail

            if (status !== 'active') {
                await log.info(`${Thornode.name}:${this.monitorJailing.name}: Node is not active. Skipping jail monitoring ...`)
                return
            }
            if (!jail.release_height) {
                await log.info(`${Thornode.name}:${this.monitorJailing.name}: Node is not jailed. Skipping jail monitoring ...`)
                return
            }

            const releaseHeight = jail.release_height
            const currentHeight = Number(cosmosRpcNodeResponse.data.result.sync_info.latest_block_height)

            // Alert if node is jailed
            if (releaseHeight > currentHeight) {
                const reason = jail.reason ?? 'unknown'
                const diff = releaseHeight - currentHeight
                await log.info(`${Thornode.name}:Jail: Node is jailed for ${numeral(diff).format('0')} more blocks! (releaseHeight = ${numeral(releaseHeight).format('0,0')}, reason = '${reason}')`)

                await betterUptime.createJailIncident(Thornode.name, reason, releaseHeight)
            } else {
                await betterUptime.resolveIncidents(Thornode.name, IncidentType.JAIL)
            }
        } catch (error) {
            await handleError(error)
        }
    }

    async monitorChainObservations() {
        await log.info(`${Thornode.name}: Monitoring chain observations ...`)

        try {
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/nodes`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.monitorChainObservations.name}: Node HTTP status code: ${nodeResponse.status}`)
                return
            }

            let activeNodes = _.filter(nodeResponse.data, (node) => {
                return node.status.toLowerCase() === 'active'
            })
            activeNodes = _.map(activeNodes, (node) => {
                return {
                    address: node.node_address,
                    observedChains: node.observe_chains
                }
            })

            // Get the thornode's address
            const nodeAddress = this.getAddress()

            // Try to find the node in the active nodes
            const node = _.find(activeNodes, (node) => {
                return node.address === nodeAddress
            })

            if (!node) {
                await log.info(`${Thornode.name}:${this.monitorChainObservations.name}: Node is not active. Skipping chain observation monitoring ...`)
                return
            }

            for(const observedChain of node.observedChains) {
                const chain = observedChain.chain.toUpperCase()
                const observedHeight = observedChain.height

                const latestObservedHeightForChain = _.max(_.map(activeNodes, (otherNode) => {
                    return _.find(otherNode.observedChains, (observedChain) => {
                        return observedChain.chain.toUpperCase() === chain
                    })?.height ?? -1 // Could be undefined for newer nodes that haven't observed previous chains (e.g. Terra)
                }))

                // Alert if node is behind on chain observations
                if (observedHeight < latestObservedHeightForChain) {
                    const diff = latestObservedHeightForChain - observedHeight
                    await log.info(`${Thornode.name}:ChainObservation: ${chain} is ${numeral(diff).format('0,0')} blocks behind the latest observation of the network! (observedHeight = ${numeral(observedHeight).format('0,0')}, latestObservedHeightForChain = ${numeral(latestObservedHeightForChain).format('0,0')})`)

                    await betterUptime.createChainObservationIncident(chain, diff)
                } else {
                    await betterUptime.resolveIncidents(chain, IncidentType.CHAIN_OBSERVATION)
                }
            }
        } catch (error) {
            await handleError(error)
        }
    }

    private getAddress(): string {
        return config.thornodeAddress!
    }
}