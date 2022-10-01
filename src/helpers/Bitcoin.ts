import axios from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from './Error.js'

export enum Fork {
    Bitcoin = 'bitcoin',
    Litecoin = 'litecoin',
    BitcoinCash = 'bitcoin-cash',
    Dogecoin = 'dogecoin'
}

const getEnumKey = (value: Fork) => {
    return Object.entries(Fork).find(([, val]) => val === value)?.[0]
}

export class Bitcoin extends Node {
    private port: number
    private readonly username: string
    private readonly password: string
    private readonly fork: Fork

    constructor(host: string, port: number, username: string, password: string, fork?: Fork) {
        super(host)
        this.port = port
        this.username = username
        this.password = password
        this.fork = fork ?? Fork.Bitcoin
    }

    async isUp(): Promise<boolean> {
        await log.info(`${getEnumKey(this.fork)}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('getblockchaininfo')
            await log.debug(`${getEnumKey(this.fork)}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getEnumKey(this.fork)}:${this.isUp.name}: Node does not respond!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getEnumKey(this.fork)}: Node is up!`)

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${getEnumKey(this.fork)}: Checking if the node is synced ...`)

        try {
            const nodeResponse = await this.query('getblockchaininfo')
            await log.debug(`${getEnumKey(this.fork)}:${this.isSynced.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getEnumKey(this.fork)}:${this.isSynced.name}: Node does not respond!`)
                return false
            }

            const nodeBlockHeight = nodeResponse.data.result.blocks
            const nodeHeaderHeight = nodeResponse.data.result.headers
            await log.debug(`${getEnumKey(this.fork)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')} | nodeHeaderHeight = ${numeral(nodeHeaderHeight).format('0,0')}`)

            // Check if node is still syncing
            if (nodeBlockHeight < nodeHeaderHeight) {
                await log.warn(`${getEnumKey(this.fork)}:${this.isSynced.name}: nodeBlockHeight < nodeHeaderHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(nodeHeaderHeight).format('0,0')}`)
                return false
            }

            const apiResponse = await axios.get(`https://api.blockchair.com/${this.fork}/stats`)
            const apiBlockHeight = apiResponse.data.data.best_block_height
            await log.debug(`${getEnumKey(this.fork)}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api consensus block height
            if (nodeBlockHeight < apiBlockHeight) {
                await log.warn(`${getEnumKey(this.fork)}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getEnumKey(this.fork)}: Node is synced!`)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${getEnumKey(this.fork)}: Checking if node version is up-to-date ...`)

        try {
            const nodeResponse = await this.query('getnetworkinfo')
            await log.debug(`${getEnumKey(this.fork)}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getEnumKey(this.fork)}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result.subversion
            await log.debug(`${getEnumKey(this.fork)}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            const apiResponse = await axios.get(`https://api.blockchair.com/${this.fork}/nodes`)
            const apiVersions = apiResponse.data.data.versions
            const topVersions = _.first(Object.keys(apiVersions).sort((a, b) => {
                return apiVersions[b] - apiVersions[a]
            }), 3)
            await log.debug(`${getEnumKey(this.fork)}:${this.isVersionUpToDate.name}: topVersions = ['${topVersions.join('\',\'')}']`)

            // Check if node version is in the top versions of the network
            if (!_.contains(topVersions, nodeVersion)) {
                await log.warn(`${getEnumKey(this.fork)}:${this.isVersionUpToDate.name}: nodeVersion not in topVersions: '${nodeVersion}' not in ['${topVersions.join('\',\'')}']`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getEnumKey(this.fork)}: Node version is up-to-date!`)

        return true
    }

    async query(method: string, host?: string, params?: []): Promise<any> {
        return await axios.post(host ?? this.host, {
            jsonrpc: '1.0',
            id: 1,
            method: method,
            params: params ?? []
        }, {
            auth: {
                username: this.username,
                password: this.password
            }
        })
    }
}