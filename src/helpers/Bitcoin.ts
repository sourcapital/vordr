import axios from 'axios'
import {Node} from './Node.js'
import {handleError} from './Error.js'
import _ from 'underscore'
import numeral from 'numeral'

export class Bitcoin extends Node {
    private port: number
    private readonly username: string
    private readonly password: string

    constructor(host: string, port: number, username: string, password: string) {
        super(host)
        this.port = port
        this.username = username
        this.password = password
    }

    async isUp(): Promise<boolean> {
        await log.info(`${Bitcoin.name}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('getblockchaininfo')
            await log.debug(`${Bitcoin.name}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            // Validate http response status
            if (nodeResponse.status !== 200) {
                await log.error(`${Bitcoin.name}:${this.isUp.name}: Node does not respond!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Bitcoin.name}: Node is up!`)

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${Bitcoin.name}: Checking if the node is synced ...`)

        try {
            const nodeResponse = await this.query('getblockchaininfo')
            await log.debug(`${Bitcoin.name}:${this.isSynced.name}: HTTP status code: ${nodeResponse.status}`)

            // Validate http response status
            if (nodeResponse.status !== 200) {
                await log.error(`${Bitcoin.name}:${this.isSynced.name}: Node does not respond!`)
                return false
            }

            const nodeBlockHeight = nodeResponse.data.result.blocks
            const nodeHeaderHeight = nodeResponse.data.result.headers
            await log.debug(`${Bitcoin.name}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')}, nodeHeaderHeight = ${numeral(nodeHeaderHeight).format('0,0')}`)

            // Check if node is still syncing
            if (nodeBlockHeight < nodeHeaderHeight) {
                await log.warn(`${Bitcoin.name}:${this.isSynced.name}: nodeBlockHeight < nodeHeaderHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(nodeHeaderHeight).format('0,0')}`)
                return false
            }

            // Get api data
            const apiResponse = await axios.get('https://api.blockchair.com/bitcoin/nodes')
            const apiBlockHeights = apiResponse.data.data.heights
            const apiBlockHeight = Object.keys(apiBlockHeights).reduce((a, b) => apiBlockHeights[a] > apiBlockHeights[b] ? a : b)
            await log.debug(`${Bitcoin.name}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api consensus block height
            if (nodeBlockHeight < apiBlockHeight) {
                await log.warn(`${Bitcoin.name}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Bitcoin.name}: Node is synced!`)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${Bitcoin.name}: Checking if node version is up-to-date ...`)

        try {
            const nodeResponse = await this.query('getnetworkinfo')
            await log.debug(`${Bitcoin.name}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            // Validate http response status
            if (nodeResponse.status !== 200) {
                await log.error(`${Bitcoin.name}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result.subversion
            await log.debug(`${Bitcoin.name}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            // Get api data
            const apiResponse = await axios.get('https://api.blockchair.com/bitcoin/nodes')
            const apiVersions = apiResponse.data.data.versions
            const topThreeVersions = _.first(Object.keys(apiVersions).sort((a, b) => {
                return apiVersions[b] - apiVersions[a]
            }), 3)

            await log.debug(`${Bitcoin.name}:${this.isVersionUpToDate.name}: topThreeVersions = ['${topThreeVersions.join('\',\'')}']`)

            // Check if node version is in the top 3 of the network
            if (!_.contains(topThreeVersions, nodeVersion)) {
                await log.warn(`${Bitcoin.name}:${this.isVersionUpToDate.name}: nodeVersion not in topThreeVersions: '${nodeVersion}' not in ['${topThreeVersions.join('\',\'')}']`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Bitcoin.name}: Node version is up-to-date!`)

        return true
    }

    async query(method: string): Promise<any> {
        return await axios.post(this.host, {
            jsonrpc: '1.0',
            id: method,
            method: method,
            params: []
        }, {
            auth: {
                username: this.username,
                password: this.password
            }
        })
    }
}