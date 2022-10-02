import axios from 'axios'
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

            // TODO: Check if this is the correct way to get the versions
            const nodeVersion = nodeResponse.data.current
            const latestVersion = nodeResponse.data.next
            await log.debug(`${Thornode.name}:${this.isVersionUpToDate.name}: nodeVersion = ${nodeVersion} | latestVersion = ${latestVersion}`)

            if (nodeVersion < latestVersion) {
                await log.warn(`${Thornode.name}:${this.isVersionUpToDate.name}: nodeVersion < latestVersion: '${nodeVersion}' < '${latestVersion}'`)
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