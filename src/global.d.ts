import {Log} from './helpers/Log.js'
import {BetterUptime} from './integrations/BetterUptime.js'
import {Kubernetes} from './integrations/Kubernetes.js'

declare global {
    var sleep: (ms: number) => Promise<unknown>
    var log: Log
    var betterUptime: BetterUptime
    var kubernetes: Kubernetes
}

export {}