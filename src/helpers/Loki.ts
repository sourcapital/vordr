import WebSocket from 'ws'
import moment from 'moment'
import {config} from '../config.js'
import {handleError} from './Error.js'

export class Loki {
    constructor() {
        const host = config.nodeENV === 'production' ? 'loki.loki-system' : 'localhost'
        const nowTsNs = moment().unix() * 1e9 // Timestamp in nano seconds
        const ws = new WebSocket(`ws://${host}:3100/loki/api/v1/tail?query={namespace="thornode"}&start=${nowTsNs}`)

        ws.on('open', async () => {
            await log.debug(`${Loki.name}: WebSocket connection opened!`)
        })

        ws.on('close', async () => {
            await log.debug(`${Loki.name}: WebSocket connection closed!`)
        })

        ws.on('error', async (error: any) => {
            if (error.code === 'ECONNREFUSED') {
                await console.error(`${Loki.name}: Unable to connect to '${host}'. Connection was refused!`)
            } else {
                await handleError(error)
            }
        })

        ws.on('message', async (data) => {
            const streams: Array<any> = JSON.parse(data.toString()).streams
            for (const stream of streams) {
                const prefix = `${Loki.name}:${stream.stream.app}`
                const value = JSON.parse(stream.values[0][1])
                const message = value.log.replaceAll(/\s+/g, ' ').replaceAll('\n', '').trim()
                const logLevel = await this.parseLogLevel(message)

                switch (logLevel) {
                    case 'debug':
                        await log.debug(`${prefix}: ${message}`)
                        break
                    case 'info':
                        await log.info(`${prefix}: ${message}`)
                        break
                    case 'warn':
                        await log.warn(`${prefix}: ${message}`)
                        break
                    case 'error':
                        await log.error(`${prefix}: ${message}`)
                        break
                }
            }
        })
    }

    private async parseLogLevel(message: any): Promise<string> {
        let logLevel: string

        const regex1 = /"*level"*[:=]"*(debug|info|warn|error)"*/g.exec(message)
        const regex2 = /([DIWE]).*\[/.exec(message)

        if (regex1) {
            logLevel = regex1.slice(1, 2)[0].toLowerCase()
        } else if (regex2) {
            logLevel = regex2.slice(1, 2)[0].toLowerCase()
        } else {
            logLevel = 'none'
        }

        switch (logLevel) {
            case 'd':
            case 'debug':
                logLevel = 'debug'
                break
            case 'i':
            case 'info':
                logLevel = 'info'
                break
            case 'w':
            case 'warn':
            case 'warning':
                logLevel = 'warn'
                break
            case 'e':
            case 'error':
                logLevel = 'error'
                break
            default:
                logLevel = 'info'
                break
        }

        return logLevel
    }
}