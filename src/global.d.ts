import {Log} from './helpers/Log.js'
import {BetterUptime} from './helpers/BetterUptime.js'

declare global {
    var sleep: (ms: number) => Promise<unknown>
    var log: Log
    var betterUptime: BetterUptime
}

export {}