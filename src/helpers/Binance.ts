import axios from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from './Error.js'

export class Binance extends Node {
    private port: number

    constructor(host: string, port: number) {
        super(host)
        this.port = port
    }

    async isUp(): Promise<boolean> {
        await log.info(`${Binance.name}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('health')
            await log.debug(`${Binance.name}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Binance.name}:${this.isUp.name}: Node does not respond!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Binance.name}: Node is up!`)

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${Binance.name}: Checking if the node is synced ...`)

        try {
            const nodeResponse = await this.query('status')
            await log.debug(`${Binance.name}:${this.isSynced.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Binance.name}:${this.isSynced.name}: Node does not respond!`)
                return false
            }

            const isSyncing = nodeResponse.data.result.sync_info.catching_up
            await log.debug(`${Binance.name}:${this.isSynced.name}: isSyncing = ${isSyncing}`)

            // Check if node is still syncing
            if (isSyncing) {
                await log.warn(`${Binance.name}:${this.isSynced.name}: Node is still syncing!`)
                return false
            }

            const nodeBlockHeight = Number(nodeResponse.data.result.sync_info.latest_block_height)
            const nodeIndexHeight = Number(nodeResponse.data.result.sync_info.index_height)
            await log.debug(`${Binance.name}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')} | nodeIndexHeight = ${numeral(nodeIndexHeight).format('0,0')}`)

            // Check if node is still syncing
            if (nodeBlockHeight < nodeIndexHeight) {
                await log.warn(`${Binance.name}:${this.isSynced.name}: nodeBlockHeight < nodeIndexHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(nodeIndexHeight).format('0,0')}`)
                return false
            }

            const apiResponse = await axios.get('https://explorer.bnbchain.org/api/v1/blocks?page=1&rows=1')
            const apiBlockHeight = apiResponse.data.blockArray['0'].blockHeight
            await log.debug(`${Binance.name}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api block height
            if (nodeBlockHeight < apiBlockHeight) {
                await log.warn(`${Binance.name}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Binance.name}: Node is synced!`)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${Binance.name}: Checking if node version is up-to-date ...`)

        try {
            let nodeResponse = await this.query('status')
            await log.debug(`${Binance.name}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${Binance.name}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result.node_info.version
            await log.debug(`${Binance.name}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            nodeResponse = await this.query('net_info')
            const nodePeers = nodeResponse.data.result.peers
            const nodePeerVersions = _.map(nodePeers, (peer) => {
                return peer.node_info.version
            })
            const nodePeerVersionCounts = _.countBy(nodePeerVersions, (version) => { return version })
            const topVersion = _.first(Object.keys(nodePeerVersionCounts).sort((a, b) => {
                return nodePeerVersionCounts[b] - nodePeerVersionCounts[a]
            }))
            await log.debug(`${Binance.name}:${this.isVersionUpToDate.name}: topVersion = '${topVersion}'`)

            // Check if node version is in the top 3 of the network
            if (nodeVersion !== topVersion) {
                await log.warn(`${Binance.name}:${this.isVersionUpToDate.name}: nodeVersion !== topVersion: '${nodeVersion}' !== '${topVersion}'`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${Binance.name}: Node version is up-to-date!`)

        return true
    }

    async query(method: string, host?: string, params?: []): Promise<any> {
        return await axios.get(`${host ?? this.host}/${method}`)
    }
}