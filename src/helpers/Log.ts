import {Logtail} from '@logtail/node'
import {config} from '../config.js'

export class Log {
    private log?: Logtail

    constructor() {
        this.log = config.betterStack.logs.sourceToken ? new Logtail(config.betterStack.logs.sourceToken) : undefined
    }

    async debug(message: string, printToConsole: boolean = true) {
        if (config.nodeENV === 'production') return // No debug logs in production

        if (printToConsole) console.debug(message)
        if (config.nodeENV === 'production') await this.log?.debug(message)
    }

    async info(message: string, printToConsole: boolean = true) {
        if (printToConsole) console.info(message)
        if (config.nodeENV === 'production') await this.log?.info(message)
    }

    async warn(message: string, printToConsole: boolean = true) {
        if (printToConsole) console.warn(message)
        if (config.nodeENV === 'production') await this.log?.warn(message)
    }

    async error(message: string, printToConsole: boolean = true) {
        if (printToConsole) console.error(message)
        if (config.nodeENV === 'production') await this.log?.error(message)
    }
}
