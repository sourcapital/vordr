import {Logtail} from '@logtail/node'
import {config} from '../config.js'

export class Log {
    private log?: Logtail

    constructor() {
        this.log = config.logtail.sourceToken ? new Logtail(config.logtail.sourceToken) : undefined
    }

    async debug(message: string) {
        if (config.nodeENV === 'production') {
            await this.log?.debug(message)
        }
    }

    async info(message: string) {
        if (config.nodeENV === 'production') {
            await this.log?.info(message)
        }
    }

    async warn(message: string) {
        if (config.nodeENV === 'production') {
            await this.log?.warn(message)
        }
    }

    async error(message: string, raise: boolean = false) {
        if (config.nodeENV === 'production') {
            await this.log?.error(message)
        }

        if (raise) {
            throw new Error(message)
        }
    }
}