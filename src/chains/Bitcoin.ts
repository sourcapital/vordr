import axios, {AxiosResponse} from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType} from '../helpers/BetterUptime.js'

export enum Chain {
    Bitcoin = 'bitcoin',
    Litecoin = 'litecoin',
    BitcoinCash = 'bitcoin-cash',
    Dogecoin = 'dogecoin'
}

const getChainName = (chain: Chain): string => {
    return Object.entries(Chain).find(([, val]) => val === chain)?.[0]!
}

export class Bitcoin extends Node {
    private readonly chain: Chain

    constructor(url: string, chain?: Chain) {
        super(url)
        this.chain = chain ?? Chain.Bitcoin
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
            const nodeResponse = await this.query('getblockchaininfo')
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
            const nodeResponse = await this.query('getblockchaininfo')
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}: Node does not respond!`)
                return false
            }

            const nodeBlockHeight = nodeResponse.data.result.blocks
            const nodeHeaderHeight = nodeResponse.data.result.headers
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')} | nodeHeaderHeight = ${numeral(nodeHeaderHeight).format('0,0')}`)

            // Check if node is still syncing
            if (nodeBlockHeight < nodeHeaderHeight) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight < nodeHeaderHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(nodeHeaderHeight).format('0,0')}`)
                return false
            }

            const apiResponse = await axios.get(`https://api.blockchair.com/${this.chain}/stats`)
            const apiBlockHeight = apiResponse.data.data.best_block_height
            await log.debug(`${getChainName(this.chain)}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api consensus block height
            if (nodeBlockHeight < apiBlockHeight) {
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
            const nodeResponse = await this.query('getnetworkinfo')
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result.subversion
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            const apiResponse = await axios.get(`https://api.blockchair.com/${this.chain}/nodes`)
            const apiVersions = apiResponse.data.data.versions
            const topVersions = _.first(Object.keys(apiVersions).sort((a, b) => {
                return apiVersions[b] - apiVersions[a]
            }), 3)
            await log.debug(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: topVersions = ['${topVersions.join('\',\'')}']`)

            // Check if node version is in the top versions of the network
            if (!_.contains(topVersions, nodeVersion)) {
                await log.warn(`${getChainName(this.chain)}:${this.isVersionUpToDate.name}: nodeVersion not in topVersions: '${nodeVersion}' not in ['${topVersions.join('\',\'')}']`)
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

    protected async query(method: string, params?: []): Promise<AxiosResponse> {
        let url = this.url
        let config = undefined

        // Check if the url contains username and password for authentication
        const regex = /([a-z]*):([a-z]*)@([a-zA-Z0-9\/:.-]+)$/g
        if (url.match(regex)) {
            config = {
                auth: {
                    username: url.replace(regex, '$1'),
                    password: url.replace(regex, '$2')
                }
            }
            url = url.replace(regex, '$3')
        }

        return await axios.post(url, {
            jsonrpc: '1.0',
            id: 1,
            method: method,
            params: params ?? [],
        }, config ?? {})
    }
}