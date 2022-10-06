import axios from 'axios'
import _ from 'underscore'
import {handleError} from '../helpers/Error.js'
import {Cosmos, Chain} from './Cosmos.js'
import {HeartbeatType} from '../helpers/BetterUptime.js'

export class Thornode extends Cosmos {
    private readonly thorRpcUrl: string

    constructor(thorUrl: string, cosmosUrl: string) {
        super(cosmosUrl, 1, Chain.Thorchain)
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
            const versions = _.map(activeNodes, (node) => { return node.version })
            const topVersion = _.max(versions, (version) => { return Number(version.replace(/\./g, '')) })
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: topVersion = ${topVersion}`)

            if (nodeVersion < topVersion) {
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
}