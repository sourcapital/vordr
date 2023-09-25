import {Log} from './helpers/Log.js'
import {Loki} from './integrations/Loki.js'
import {Kubernetes} from './integrations/Kubernetes.js'
import {BetterStack} from './integrations/BetterStack.js'

declare global {
    var sleep: (ms: number) => Promise<unknown>
    var log: Log
    var betterStack: BetterStack
    var kubernetes: Kubernetes
    var loki: Loki
}

export {}
