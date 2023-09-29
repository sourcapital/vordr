import _ from 'underscore'
import {config} from './config.js'
import {Log} from './helpers/Log.js'
import {Cron} from './helpers/Cron.js'
import {Loki} from './integrations/Loki.js'
import {Kubernetes} from './integrations/Kubernetes.js'
import {BetterStack} from './integrations/BetterStack.js'
import {Thornode} from './chains/Thornode.js'
import {Binance} from './chains/Binance.js'
import {Bitcoin} from './chains/Bitcoin.js'
import {Ethereum} from './chains/Ethereum.js'
import {Litecoin} from './chains/Litecoin.js'
import {BitcoinCash} from './chains/BitcoinCash.js'
import {Dogecoin} from './chains/Dogecoin.js'
import {Cosmos} from './chains/Cosmos.js'
import {Avalanche} from './chains/Avalanche.js'
import {BinanceSmart} from './chains/BinanceSmart.js'

// Setup globals
global.sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
global.log = new Log()
global.betterStack = new BetterStack(config.betterStack.uptime.apiKey)
global.kubernetes = new Kubernetes()
global.loki = new Loki()

// Init nodes
const nodes = [
    new Thornode(config.nodeEndpoint.thornode, config.nodeEndpoint.thorchain),
    new Binance(config.nodeEndpoint.binanceChain),
    new Bitcoin(config.nodeEndpoint.bitcoin),
    new Ethereum(config.nodeEndpoint.ethereum),
    new Litecoin(config.nodeEndpoint.litecoin),
    new BitcoinCash(config.nodeEndpoint.bitcoinCash),
    new Dogecoin(config.nodeEndpoint.dogecoin),
    new Cosmos(config.nodeEndpoint.cosmos),
    new Avalanche(config.nodeEndpoint.avalanche),
    new BinanceSmart(config.nodeEndpoint.binanceSmart)
]

// Setup BetterStack heartbeats (in correct sequence)
await log.info('Setup BetterStack heartbeats ...')
for (const node of nodes) {
    await node.initHeartbeats()
}
// Setup BetterStack incident cleanup
await log.info('Setup BetterStack incident cleanup ...')
await betterStack.setupCleanup('0 0 * * * *') // once per hour
// Setup k8s pod restart monitoring
await log.info('Setup k8s pod restart monitoring ...')
await kubernetes.setupRestartMonitoring('0 * * * * *') // every minute
// Connect to Loki
await log.info('Setup Loki connection ...')
await loki.connect()

// Run basic node health monitoring every minute
await log.info('Setup chain daemon monitoring ...')
new Cron('0 * * * * *', async () => {
    await Promise.all(_.flatten(_.map(nodes, (node) => {
        return [
            node.isUp(),
            node.isSynced()
        ]
    })))
}).run()

// Run THORNode specific monitoring every minute
await log.info('Setup THORNode monitoring ...')
new Cron('0 * * * * *', async () => {
    const thornode = _.find(nodes, (node) => {
        return node.constructor.name === Thornode.name
    }) as Thornode

    await Promise.all([
        thornode.monitorVersion(),
        thornode.monitorBond(),
        thornode.monitorSlashPoints(),
        thornode.monitorJailing(),
        thornode.monitorChainObservations()
    ])
}).run()
