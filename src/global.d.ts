import {Log} from './helpers/Log.js'
import {Kubernetes} from './integrations/Kubernetes.js'
import {BetterUptime} from './integrations/BetterUptime.js'
import {Loki} from './integrations/Loki.js'

declare global {
    var sleep: (ms: number) => Promise<unknown>
    var log: Log
    var betterUptime: BetterUptime
    var kubernetes: Kubernetes
    var loki: Loki
}

export {}