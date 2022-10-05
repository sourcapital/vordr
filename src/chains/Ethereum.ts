import axios, {AxiosResponse} from 'axios'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType} from '../helpers/BetterUptime.js'

export enum Chain {
    Ethereum = 'ethereum',
    Avalanche = 'avalanche'
}

const getChainName = (chain: Chain): string => {
    return Object.entries(Chain).find(([, val]) => val === chain)?.[0]!
}

export class Ethereum extends Node {
    private readonly chain: Chain

    constructor(url: string, blockDelay?: number, chain?: Chain) {
        super(url, blockDelay ?? 1)
        this.chain = chain ?? Chain.Ethereum
    }

    async initHeartbeats() {
        await betterUptime.initHeartbeats(getChainName(this.chain), [
            HeartbeatType.HEALTH,
            HeartbeatType.SYNC_STATUS,
            HeartbeatType.VERSION
        ])
    }

    async isUp(): Promise<boolean> {
        await log.info(`${getChainName(this.chain)}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('eth_syncing')
            await log.debug(`${getChainName(this.chain)}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isUp.name}: Node does not respond!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getChainName(this.chain)}: Node is up!`)
        await betterUptime.sendHeartbeat(getChainName(this.chain), HeartbeatType.HEALTH)

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${getChainName(this.chain)}: Checking if the node is synced ...`)

        try {
            let nodeResponse = await this.query('eth_syncing')
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}:eth_syncing: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}:eth_syncing: Node does not respond!`)
                return false
            }

            const isSyncing = nodeResponse.data.result
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: isSyncing = ${isSyncing}`)

            // Check if node is still syncing
            if (isSyncing) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: Node is still syncing!`)
                return false
            }

            nodeResponse = await this.query('eth_blockNumber')
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}:eth_blockNumber: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}:eth_blockNumber: Node does not respond!`)
                return false
            }

            const nodeBlockHeight = Number(nodeResponse.data.result)
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')}`)

            let apiResponse: any
            let apiBlockHeight: number

            switch (this.chain) {
                case Chain.Ethereum:
                    apiResponse = await axios.get(`https://api.blockchair.com/ethereum/stats`)
                    apiBlockHeight = apiResponse.data.data.best_block_height
                    break
                case Chain.Avalanche:
                    apiResponse = await this.query('eth_blockNumber', 'https://api.avax.network/ext/bc/C/rpc')
                    apiBlockHeight = Number(apiResponse.data.result)
                    break
            }
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api block height
            if (nodeBlockHeight < apiBlockHeight - this.blockDelay) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getChainName(this.chain)}: Node is synced!`)
        await betterUptime.sendHeartbeat(getChainName(this.chain), HeartbeatType.SYNC_STATUS)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${getChainName(this.chain)}: Checking if node version is up-to-date ...`)

        try {
            const nodeResponse = await this.query('web3_clientVersion')
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)
        } catch (error: any) {
            // Check if the node does not allow to query the method
            if (error?.response?.status === 403) {
                await log.warn(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: Node does not allow to query 'web3_clientVersion'!`)
            } else {
                await handleError(error)
            }

            return false
        }

        await log.info(`${getChainName(this.chain)}: Node version is up-to-date!`)
        await betterUptime.sendHeartbeat(getChainName(this.chain), HeartbeatType.VERSION)

        return true
    }

    protected async query(method: string, url?: string, params?: []): Promise<AxiosResponse> {
        return await axios.post(url ?? this.url, {
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params ?? []
        })
    }
}