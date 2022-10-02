import axios from 'axios'
import _ from 'underscore'
import {handleError} from './Error.js'
import {Cosmos, Chain} from './Cosmos.js'

export class Thornode extends Cosmos {
    private readonly thorRpcUrl: string
    private readonly thorRpcPort: number

    constructor(thorRpcUrl: string, thorRpcPort: number, cosmosRpcUrl: string, cosmosRpcPort: number) {
        super(cosmosRpcUrl, cosmosRpcPort, Chain.Thorchain)
        this.thorRpcUrl = thorRpcUrl
        this.thorRpcPort = thorRpcPort
    }

    async isUp(): Promise<boolean> {
        await log.info(`${Thornode.name}: Checking if the node is up ...`)

        try {
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/ping`)
            await log.debug(`${Thornode.name}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.isUp.name}: Node does not respond!`)
                return false
            }

            const nodePong = nodeResponse.data.ping
            await log.debug(`${Thornode.name}:${this.isUp.name}: ping -> ${nodePong}`)

            if (nodePong !== 'pong') {
                await log.error(`${Thornode.name}:${this.isUp.name}: Node does not respond to 'ping' with 'pong'!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Thornode.name}: Node is up!`)

        return await super.isUp()
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${Thornode.name}: Checking if node version is up-to-date ...`)

        try {
            const nodeResponse = await axios.get(`${this.thorRpcUrl}/thorchain/version`)
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.current
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: nodeVersion = ${nodeVersion}`)

            const networkResponse = await axios.get(`${this.thorRpcUrl}/thorchain/nodes`)
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: HTTP status code: ${networkResponse.status}`)

            if (networkResponse.status !== 200) {
                await log.error(`${Thornode.name}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const activeNodes = _.filter(networkResponse.data, (node) => {
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

        return await super.isVersionUpToDate()
    }
}