import WebSocket from 'ws'
import moment from 'moment'
import {config} from '../config.js'
import {handleError} from './Error.js'

export class Loki {
    private ws?: WebSocket
    private retries = 3

    async connect() {
        await log.debug(`${Loki.name}: Connecting ...`)

        const host = config.nodeENV === 'production' ? 'loki.loki-system' : 'localhost'
        const nowTsNs = moment().unix() * 1e9 // Timestamp in nano seconds
        this.ws = new WebSocket(`ws://${host}:3100/loki/api/v1/tail?query={namespace="thornode"}&start=${nowTsNs}`)

        this.ws.on('open', async () => {
            await log.debug(`${Loki.name}: WebSocket connected!`)
            this.retries = 3
        })

        this.ws.on('close', async () => {
            await log.debug(`${Loki.name}: WebSocket disconnected!`)
            this.retries -= 1

            if (this.retries > 0) {
                await log.debug(`${Loki.name}: Reconnecting ...`)
                await sleep(1000)
                await this.connect()
            }
        })

        this.ws.on('error', async (error: any) => {
            if (error.code === 'ECONNREFUSED') {
                await console.error(`${Loki.name}: Unable to connect to '${host}'. Connection was refused!`)
            } else {
                await handleError(error)
            }
        })

        this.ws.on('message', async (data) => {
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

    private async parseLogLevel(message: string): Promise<string> {
        message = message.toLowerCase()

        const regex1 = /(debug|info|warn|error)/g.exec(message)
        const regex2 = /([diwe]).*\[/.exec(message)

        let logLevel: string
        if (regex1) {
            logLevel = regex1.slice(1, 2)[0]
        } else if (regex2) {
            logLevel = regex2.slice(1, 2)[0]
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