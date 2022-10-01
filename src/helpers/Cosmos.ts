import axios from 'axios'
import _ from 'underscore'
import numeral from 'numeral'
import {Node} from './Node.js'
import {handleError} from './Error.js'

export enum AppChain {
    Cosmos = 'cosmos',
    Binance = 'binance'
}

const getEnumKey = (value: AppChain) => {
    return Object.entries(AppChain).find(([, val]) => val === value)?.[0]
}

export class Cosmos extends Node {
    private port: number
    private readonly appChain: AppChain

    constructor(host: string, port: number, appChain?: AppChain) {
        super(host)
        this.port = port
        this.appChain = appChain ?? AppChain.Cosmos
    }

    async isUp(): Promise<boolean> {
        await log.info(`${getEnumKey(this.appChain)}: Checking if the node is up ...`)

        try {
            const nodeResponse = await this.query('health')
            await log.debug(`${getEnumKey(this.appChain)}:${this.isUp.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getEnumKey(this.appChain)}:${this.isUp.name}: Node does not respond!`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getEnumKey(this.appChain)}: Node is up!`)

        return true
    }

    async isSynced(): Promise<boolean> {
        await log.info(`${getEnumKey(this.appChain)}: Checking if the node is synced ...`)

        try {
            const nodeResponse = await this.query('status')
            await log.debug(`${getEnumKey(this.appChain)}:${this.isSynced.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getEnumKey(this.appChain)}:${this.isSynced.name}: Node does not respond!`)
                return false
            }

            const isSyncing = nodeResponse.data.result.sync_info.catching_up
            await log.debug(`${getEnumKey(this.appChain)}:${this.isSynced.name}: isSyncing = ${isSyncing}`)

            // Check if node is still syncing
            if (isSyncing) {
                await log.warn(`${getEnumKey(this.appChain)}:${this.isSynced.name}: Node is still syncing!`)
                return false
            }

            const nodeBlockHeight = Number(nodeResponse.data.result.sync_info.latest_block_height)
            await log.debug(`${getEnumKey(this.appChain)}:${this.isSynced.name}: nodeBlockHeight = ${numeral(nodeBlockHeight).format('0,0')}`)

            let apiResponse: any
            let apiBlockHeight: number

            switch (this.appChain) {
                case AppChain.Cosmos:
                    apiResponse = await axios.get('https://api.cosmos.network/blocks/latest')
                    apiBlockHeight = apiResponse.data.block.header.height
                    break
                case AppChain.Binance:
                    apiResponse = await axios.get('https://dex.binance.org/api/v1/node-info')
                    apiBlockHeight = apiResponse.data.sync_info.latest_block_height
                    break
            }
            await log.debug(`${getEnumKey(this.appChain)}:${this.isSynced.name}: apiBlockHeight = ${numeral(apiBlockHeight).format('0,0')}`)

            // Check if node is behind the api block height
            if (nodeBlockHeight < apiBlockHeight) {
                await log.warn(`${getEnumKey(this.appChain)}:${this.isSynced.name}: nodeBlockHeight < apiBlockHeight: ${numeral(nodeBlockHeight).format('0,0')} < ${numeral(apiBlockHeight).format('0,0')}`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getEnumKey(this.appChain)}: Node is synced!`)

        return true
    }

    async isVersionUpToDate(): Promise<boolean> {
        await log.info(`${getEnumKey(this.appChain)}: Checking if node version is up-to-date ...`)

        try {
            let nodeResponse = await this.query('status')
            await log.debug(`${getEnumKey(this.appChain)}:${this.isVersionUpToDate.name}: HTTP status code: ${nodeResponse.status}`)

            if (nodeResponse.status !== 200) {
                await log.error(`${getEnumKey(this.appChain)}:${this.isVersionUpToDate.name}: Node does not respond!`)
                return false
            }

            const nodeVersion = nodeResponse.data.result.node_info.version
            await log.debug(`${getEnumKey(this.appChain)}:${this.isVersionUpToDate.name}: nodeVersion = '${nodeVersion}'`)

            nodeResponse = await this.query('net_info')
            const nodePeers = nodeResponse.data.result.peers
            const nodePeerVersions = _.map(nodePeers, (peer) => {
                return peer.node_info.version
            })
            const nodePeerVersionCounts = _.countBy(nodePeerVersions, (version) => { return version })
            const topVersion = _.first(Object.keys(nodePeerVersionCounts).sort((a, b) => {
                return nodePeerVersionCounts[b] - nodePeerVersionCounts[a]
            }))
            await log.debug(`${getEnumKey(this.appChain)}:${this.isVersionUpToDate.name}: topVersion = '${topVersion}'`)

            // Check if node is up-to-date
            if (nodeVersion !== topVersion) {
                await log.warn(`${getEnumKey(this.appChain)}:${this.isVersionUpToDate.name}: nodeVersion !== topVersion: '${nodeVersion}' !== '${topVersion}'`)
                return false
            }
        } catch (error) {
            await handleError(error)
            return false
        }

        await log.info(`${getEnumKey(this.appChain)}: Node version is up-to-date!`)

        return true
    }

    async query(method: string, host?: string, params?: []): Promise<any> {
        return await axios.get(`${host ?? this.host}/${method}`)
    }
}