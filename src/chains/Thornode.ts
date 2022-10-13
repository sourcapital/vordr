import axios from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {handleError} from '../helpers/Error.js'
import {Cosmos, Chain} from './Cosmos.js'
import {HeartbeatType} from '../integrations/BetterUptime.js'

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

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${Thornode.name}: Checking if node version is up-to-date ...`)

        try {
            const [nodeResponseVersion, nodeResponseNodes] = await Promise.all([
                axios.get(`${this.thorRpcUrl}/thorchain/version`),
                axios.get(`${this.thorRpcUrl}/thorchain/nodes`)
            ])

            if (nodeResponseVersion.status !== 200) {
                await log.error(`${Thornode.name}:${this.isVersionUpToDate.name}:version: Node HTTP status code: ${nodeResponseVersion.status}`)
                return false
            }
            if (nodeResponseNodes.status !== 200) {
                await log.error(`${Thornode.name}:${this.isVersionUpToDate.name}:nodes: Node HTTP status code: ${nodeResponseNodes.status}`)
                return false
            }

            const nodeVersion = nodeResponseVersion.data.current
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: nodeVersion = ${nodeVersion}`)

            const activeNodes = _.filter(nodeResponseNodes.data, (node) => {
                return node.status.toLowerCase() === 'active'
            })
            const versions = _.map(activeNodes, (node) => {
                return node.version
            })
            const topVersion = _.max(versions, (version) => {
                return Number(version.replace(/\./g, ''))
            })
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: topVersion = ${topVersion}`)

            // Parse version as numbers so they can be compared
            const nodeVersionAsNumber = Number(/([0-9]+)\.([0-9]+)\.([0-9]+)/g.exec(nodeVersion)!.slice(1, 4).join(''))
            const topVersionAsNumber = Number(/([0-9]+)\.([0-9]+)\.([0-9]+)/g.exec(topVersion)!.slice(1, 4).join(''))

            if (nodeVersionAsNumber < topVersionAsNumber) {
                await log.warn(`${Thornode.name}:${this.isVersionUpToDate.name}: nodeVersion < topVersion: '${nodeVersion}' < '${topVersion}'`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Thornode.name}: Node version is up-to-date!`)
        await betterUptime.sendHeartbeat(Thornode.name, HeartbeatType.VERSION)

        return await super.isVersionUpToDate()
    }

    async monitorSlashPoints() {
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

            // Get the thornode's address from the Kubernetes pod
            const nodeAddress = await kubernetes.getThornodeAddress()

            // Try to find the node in the active nodes
            const node = _.find(activeNodes, (node) => {
                return node.address === nodeAddress
            })

            if (!node) {
                await log.info(`${Thornode.name}:${this.monitorSlashPoints.name}: Node is not active. Skipping slash points monitoring ...`)
                return
            }

            // Use the worst performing 10% as threshold
            const threshold = activeNodes[Math.floor(activeNodes.length / 10)].slashPoints
            const min = _.min(activeNodes, (node) => {
                return node.slashPoints
            }).slashPoints
            const max = _.max(activeNodes, (node) => {
                return node.slashPoints
            }).slashPoints

            await log.info(`${Thornode.name}:SlashPoints: ${node.slashPoints} | network = ${numeral(min).format('0,0')} (min), ${numeral(threshold).format('0,0')} (threshold), ${numeral(max).format('0,0')} (max)`)

            // Alert if slash points are above threshold
            if (node.slashPoints > threshold) {
                await betterUptime.createSlashPointIncident(Thornode.name, node.slashPoints, threshold, min, max)
            }
        } catch (error) {
            await handleError(error)
        }
    }
}