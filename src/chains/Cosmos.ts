import axios, {AxiosResponse} from 'axios'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType} from '../integrations/BetterUptime.js'

export enum Chain {
    Cosmos = 'cosmos',
    Binance = 'binance',
    Thorchain = 'thorchain'
}

const getChainName = (chain: string | Chain): string => {
    return Object.entries(Chain).find(([, val]) => val === chain)?.[0]!
}

export class Cosmos extends Node {
    private readonly chain: Chain

    constructor(url: string, chain?: Chain) {
        super(url)
        this.chain = chain ?? Chain.Cosmos
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
            const nodeResponse = await axios.get(`${this.url}/health`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isUp.name}:health: Node HTTP status code: ${nodeResponse.status}`)
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
            let apiRequest: Promise<AxiosResponse>
            switch (this.chain) {
                case Chain.Cosmos:
                    apiRequest = axios.get('https://api.cosmos.network/blocks/latest')
                    break
                case Chain.Binance:
                    apiRequest = axios.get('https://dex.binance.org/api/v1/node-info')
                    break
                case Chain.Thorchain:
                    apiRequest = axios.get('https://rpc.ninerealms.com/status')
                    break
            }

            // Await all time critical request together to minimize any delay (e.g. difference in block height)
            const [nodeResponse, apiResponse] = await Promise.all([
                axios.get(`${this.url}/status`),
                apiRequest
            ])

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}:status: Node HTTP status code: ${nodeResponse.status}`)
                return false
            }
            if (apiResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}: API HTTP status code: ${apiResponse.status}`)
                return false
            }

            const isSyncing = nodeResponse.data.result.sync_info.catching_up
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: isSyncing = ${isSyncing}`)

            // Check if node is still syncing
            if (isSyncing) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: Node is still syncing!`)
                return false
            }

            const nodeBlockHeight = Number(nodeResponse.data.result.sync_info.latest_block_height)

            let apiBlockHeight: number
            switch (this.chain) {
                case Chain.Cosmos:
                    apiBlockHeight = apiResponse.data.block.header.height
                    break
                case Chain.Binance:
                    apiBlockHeight = apiResponse.data.sync_info.latest_block_height
                    break
                case Chain.Thorchain:
                    apiBlockHeight = Number(apiResponse.data.result.sync_info.latest_block_height)
                    break
            }
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
}