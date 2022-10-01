import axios from 'axios'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from './Error.js'

export class Ethereum extends Node {
    private port: number

    constructor(host: string, port: number) {
        super(host)
        this.port = port
    }

    async isUp(): Promise<boolean> {
        await log.info(`${Ethereum.name}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('eth_syncing')
            await log.debug(`${Ethereum.name}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Ethereum.name}:${this.isUp.name}: Node does not respond!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Ethereum.name}: Node is up!`)

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${Ethereum.name}: Checking if the node is synced ...`)

        try {
            let nodeResponse = await this.query('eth_syncing')
            await log.debug(`${Ethereum.name}:${this.isSynced.name}:eth_syncing: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Ethereum.name}:${this.isSynced.name}:eth_syncing: Node does not respond!`)
                return false
            }

            const isSyncing = nodeResponse.data.result
            await log.debug(`${Ethereum.name}:${this.isSynced.name}: isSyncing = ${isSyncing}`)

            // Check if node is still syncing
            if (isSyncing) {
                await log.warn(`${Ethereum.name}:${this.isSynced.name}: Node is still syncing!`)
                return false
            }

            nodeResponse = await this.query('eth_blockNumber')
            await log.debug(`${Ethereum.name}:${this.isSynced.name}:eth_blockNumber: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Ethereum.name}:${this.isSynced.name}:eth_blockNumber: Node does not respond!`)
                return false
            }

            const nodeBlockHeight = Number(nodeResponse.data.result)
            await log.debug(`${Ethereum.name}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')}`)

            const apiResponse = await axios.get('https://api.blockchair.com/ethereum/stats')
            const apiBlockHeight = apiResponse.data.data.best_block_height
            await log.debug(`${Ethereum.name}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api block height
            if (nodeBlockHeight < apiBlockHeight) {
                await log.warn(`${Ethereum.name}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Ethereum.name}: Node is synced!`)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${Ethereum.name}: Checking if node version is up-to-date ...`)

        try {
            const nodeResponse = await this.query('web3_clientVersion')
            await log.debug(`${Ethereum.name}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Ethereum.name}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result
            await log.debug(`${Ethereum.name}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)
        } catch (error: any) {
            // Check if the node does not allow to query the method
            if (error?.response?.status === 403) {
                await log.warn(`${Ethereum.name}:${this.isVersionUpToDate.name}: Node does not allow to query 'web3_clientVersion'!`)
            } else {
                await handleError(error)
            }

            return false
        }

        await log.info(`${Ethereum.name}: Node version is up-to-date!`)

        return true
    }

    protected async query(method: string, host?: string, params?: []): Promise<any> {
        return await axios.post(host ?? this.host, {
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params ?? []
        })
    }
}