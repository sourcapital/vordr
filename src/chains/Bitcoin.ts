import axios, {AxiosResponse} from 'axios'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from '../helpers/Error.js'
import {HeartbeatType} from '../integrations/BetterUptime.js'

export enum Chain {
    Bitcoin = 'bitcoin',
    Litecoin = 'litecoin',
    BitcoinCash = 'bitcoin-cash',
    Dogecoin = 'dogecoin'
}

const getChainName = (chain: string | Chain): string => {
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
            HeartbeatType.SYNC_STATUS
        ])
    }

    async isUp(): Promise<boolean> {
        await log.debug(`${getChainName(this.chain)}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('getblockchaininfo')

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isUp.name}:getblockchaininfo: Node HTTP status code: ${nodeResponse.status}`)
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
            // Await all time critical request together to minimize any delay (e.g. difference in block height)
            const [nodeResponse, apiResponse] = await Promise.all([
                this.query('getblockchaininfo'),
                this.query('getblockchaininfo', `https://thorchain:password@${this.chain}.ninerealms.com`),
            ])

            if (nodeResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}:getblockchaininfo: Node HTTP status code: ${nodeResponse.status}`)
                return false
            }
            if (apiResponse.status !== 200) {
                await log.error(`${getChainName(this.chain)}:${this.isSynced.name}: API HTTP status code: ${apiResponse.status}`)
                return false
            }

            const nodeBlockHeight = nodeResponse.data.result.blocks
            const nodeHeaderHeight = nodeResponse.data.result.headers

            // Check if node is still syncing
            if (nodeBlockHeight < nodeHeaderHeight) {
                await log.warn(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight < nodeHeaderHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(nodeHeaderHeight).format('0,0')}`)
                return false
            }

            const apiBlockHeight = apiResponse.data.result.blocks
            await log.info(`${getChainName(this.chain)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')}; apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api consensus block height (1 block behind is ok due to network latency)
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
        url = url ?? this.url
        let config = undefined

        // Check if the url contains username and password for authentication
        const regex = /(https*:\/\/)([a-z]*):([a-z]*)@([a-zA-Z0-9\/:.-]+)$/g
        if (url.match(regex)) {
            config = {
                auth: {
                    username: url.replace(regex, '$2'),
                    password: url.replace(regex, '$3')
                }
            }
            url = url.replace(regex, '$1') + url.replace(regex, '$4')
        }

        return axios.post(url, {
            jsonrpc: '1.0',
            id: 1,
            method: method,
            params: params ?? [],
        }, config ?? {})
    }
}
