import axios, {AxiosResponse} from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType} from '../helpers/BetterUptime.js'

export enum Chain {
    Cosmos = 'cosmos',
    Binance = 'binance',
    Thorchain = 'thorchain'
}

const getChainName = (chain: Chain): string => {
    return Object.entries(Chain).find(([, val]) => val === chain)?.[0]!
}

export class Cosmos extends Node {
    private readonly chain: Chain

    constructor(url: string, blockDelay?: number, chain?: Chain) {
        super(url, blockDelay ?? 1)
        this.chain = chain ?? Chain.Cosmos
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
        await log.info(`${getChainName(this.chain)}: Checking if the node is synced ...`)

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
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')}`)

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
            const [nodeResponseStatus, nodeResponseNetInfo] = await Promise.all([
                axios.get(`${this.url}/status`),
                axios.get(`${this.url}/net_info`)
            ])

            if (nodeResponseStatus.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}:status: Node HTTP status code: ${nodeResponseStatus.status}`)
                return false
            }
            if (nodeResponseNetInfo.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}:net_info: Node HTTP status code: ${nodeResponseNetInfo.status}`)
                return false
            }

            const nodeVersion = nodeResponseStatus.data.result.node_info.version
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            const nodePeers = nodeResponseNetInfo.data.result.peers
            const nodePeerVersions = _.map(nodePeers, (peer) => {
                return peer.node_info.version
            })
            const nodePeerVersionCounts = _.countBy(nodePeerVersions, (version) => { return version })
            const topVersion = _.first(Object.keys(nodePeerVersionCounts).sort((a, b) => {
                return nodePeerVersionCounts[b] - nodePeerVersionCounts[a]
            }))
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: topVersion = '${topVersion}'`)

            if (nodeVersion !== topVersion) {
                await log.warn(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: nodeVersion !== topVersion: '${nodeVersion}' !== '${topVersion}'`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getChainName(this.chain)}: Node version is up-to-date!`)
        await betterUptime.sendHeartbeat(getChainName(this.chain), HeartbeatType.VERSION)

        return true
    }
}