import axios, {AxiosResponse} from 'axios'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType} from '../integrations/BetterUptime.js'

export enum Chain {
    Ethereum = 'ethereum',
    Avalanche = 'avalanche'
}

const getChainName = (chain: string | Chain): string => {
    return Object.entries(Chain).find(([, val]) => val === chain)?.[0]!
}

export class Ethereum extends Node {
    private readonly chain: Chain

    constructor(url: string, chain?: Chain) {
        super(url)
        this.chain = chain ?? Chain.Ethereum
    }

    async initHeartbeats() {
        await betterUptime.initHeartbeats(getChainName(this.chain), [
            HeartbeatType.HEALTH,
            HeartbeatType.SYNC_STATUS
        ])
    }

    async isUp(): Promise<boolean> {
        await log.debug(`${getChainName(this.chain)}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('eth_syncing')

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isUp.name}:eth_syncing: Node HTTP status code: ${nodeResponse.status}`)
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
        await log.debug(`${getChainName(this.chain)}: Checking if the node is synced ...`)

        try {
            let apiUrl: string
            let backupApiUrl: string
            switch (this.chain) {
                case Chain.Ethereum:
                    apiUrl = 'https://ethereum.ninerealms.com'
                    backupApiUrl = 'https://eth.llamarpc.com'
                    break
                case Chain.Avalanche:
                    apiUrl = 'https://avalanche.ninerealms.com/ext/bc/C/rpc'
                    backupApiUrl = 'https://1rpc.io/avax/c'
                    break
            }

            // Await all time critical request together to minimize any delay (e.g. difference in block height)
            const [nodeResponseSync, nodeResponseBlockNumber, apiResponse, backupApiResponse] = await Promise.all([
                this.query('eth_syncing'),
                this.query('eth_blockNumber'),
                this.query('eth_blockNumber', apiUrl),
                this.query('eth_blockNumber', backupApiUrl)
            ])

            if (nodeResponseSync.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}:eth_syncing: Node HTTP status code: ${nodeResponseSync.status}`)
                return false
            }
            const isSyncing = nodeResponseSync.data.result
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: isSyncing = ${isSyncing}`)

            // Check if node is still syncing
            if (isSyncing) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: Node is still syncing!`)
                return false
            }

            if (nodeResponseBlockNumber.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}:eth_blockNumber: Node HTTP status code: ${nodeResponseBlockNumber.status}`)
                return false
            }
            const nodeBlockHeight = Number(nodeResponseBlockNumber.data.result)

            // Get API block height
            let apiBlockHeight = 0
            if (apiResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}: API HTTP status code: ${apiResponse.status}`)
            } else {
                apiBlockHeight = Number(apiResponse.data.result)
            }

            // Get backup API block height
            let backupApiBlockHeight = 0
            if (backupApiResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}: Backup API HTTP status code: ${backupApiResponse.status}`)
            } else {
                backupApiBlockHeight = Number(backupApiResponse.data.result)
            }

            // Use the highest block height
            apiBlockHeight = Math.max(apiBlockHeight, backupApiBlockHeight)

            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')} | apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api block height (1 block behind is ok due to network latency)
            if (nodeBlockHeight < apiBlockHeight - 1) {
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

    private query(method: string, url?: string, params?: []): Promise<AxiosResponse> {
        return axios.post(url ?? this.url, {
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params ?? []
        })
    }
}