import axios from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from './Error.js'

export enum Chain {
    Cosmos = 'cosmos',
    Binance = 'binance',
    Thorchain = 'thorchain'
}

const getChainName = (chain: Chain) => {
    return Object.entries(Chain).find(([, val]) => val === chain)?.[0]
}

export class Cosmos extends Node {
    private readonly chain: Chain

    constructor(url: string, port: number, chain?: Chain) {
        super(url, port)
        this.chain = chain ?? Chain.Cosmos
    }

    async isUp(): Promise<boolean> {
        await log.info(`${getChainName(this.chain)}: Checking if the node is up ...`)

        try {
            const nodeResponse = await axios.get(`${this.url}/health`)
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

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${getChainName(this.chain)}: Checking if the node is synced ...`)

        try {
            const nodeResponse = await axios.get(`${this.url}/status`)
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}: Node does not respond!`)
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

            let apiResponse: any
            let apiBlockHeight: number

            switch (this.chain) {
                case Chain.Cosmos:
                    apiResponse = await axios.get('https://api.cosmos.network/blocks/latest')
                    apiBlockHeight = apiResponse.data.block.header.height
                    break
                case Chain.Binance:
                    apiResponse = await axios.get('https://dex.binance.org/api/v1/node-info')
                    apiBlockHeight = apiResponse.data.sync_info.latest_block_height
                    break
                case Chain.Thorchain:
                    apiResponse = await axios.get(`https://rpc.ninerealms.com/status`)
                    apiBlockHeight = Number(apiResponse.data.result.sync_info.latest_block_height)
                    break
            }
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api block height
            if (nodeBlockHeight < apiBlockHeight) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getChainName(this.chain)}: Node is synced!`)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${getChainName(this.chain)}: Checking if node version is up-to-date ...`)

        try {
            let nodeResponse = await axios.get(`${this.url}/status`)
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result.node_info.version
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            nodeResponse = await axios.get(`${this.url}/net_info`)
            const nodePeers = nodeResponse.data.result.peers
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

        return true
    }
}