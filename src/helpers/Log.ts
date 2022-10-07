import {Logtail} from '@logtail/node'
import {config} from '../config.js'

export class Log {
    private log?: Logtail

    constructor() {
        this.log = config.logtail.apiKey ? new Logtail(config.logtail.apiKey) : undefined
    }

    async debug(message: string) {
        console.debug(message)

        if (config.nodeENV === 'production') {
            await this.log?.debug(message)
        }
    }

    async info(message: string) {
        console.info(message)

        if (config.nodeENV === 'production') {
            await this.log?.info(message)
        }
    }

    async warn(message: string) {
        console.warn(message)

        if (config.nodeENV === 'production') {
            await this.log?.warn(message)
        }
    }

    async error(message: string, raise: boolean = false) {
        console.error(message)

        if (config.nodeENV === 'production') {
            await this.log?.error(message)
        }

        if (raise) {
            throw new Error(message)
        }
    }
}