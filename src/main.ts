import {Logtail} from '@logtail/node'
import {CronJob} from 'cron'
import _ from 'underscore'
import {config} from './config.js'
import {Log} from './helpers/Log.js'
import {BetterUptime} from './helpers/BetterUptime.js'
import {handleError} from './helpers/Error.js'
import {Bitcoin} from './chains/Bitcoin.js'
import {Litecoin} from './chains/Litecoin.js'
import {BitcoinCash} from './chains/BitcoinCash.js'
import {Dogecoin} from './chains/Dogecoin.js'
import {Ethereum} from './chains/Ethereum.js'
import {Avalanche} from './chains/Avalanche.js'
import {Cosmos} from './chains/Cosmos.js'
import {Binance} from './chains/Binance.js'
import {Thornode} from './chains/Thornode.js'

// Setup globals
global.sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
global.log = new Log(new Logtail(config.logtail.apiKey))
global.betterUptime = new BetterUptime(config.betterUptime.apiKey)

// Init nodes
const nodes = [
    new Thornode('https://thornode.ninerealms.com', 1317, 'https://rpc.ninerealms.com', 27147),
    new Binance('https://binance.ninerealms.com', 27147),
    new Bitcoin('https://bitcoin.ninerealms.com', 8332, 'thorchain', 'password'),
    new Ethereum('https://ethereum.ninerealms.com', 8545),
    new Litecoin('https://litecoin.ninerealms.com', 9332, 'thorchain', 'password'),
    new BitcoinCash('https://bitcoin-cash.ninerealms.com', 8332, 'thorchain', 'password'),
    new Dogecoin('https://dogecoin.ninerealms.com', 22555, 'thorchain', 'password'),
    new Cosmos('https://gaia.ninerealms.com', 26657),
    new Avalanche('https://avalanche.ninerealms.com/ext/bc/C/rpc', 9650)
]

// Init heartbeats in correct sequence
for (const node of nodes) {
    await node.initHeartbeats()
}
await log.info('Heartbeats initialized! ❤️')

// Run node monitoring every minute
new CronJob('* * * * *', async () => {
    try {
        // Check all nodes
        const jobs = _.flatten(_.map(nodes, (node) => {
            return [
                node.isUp(),
                node.isSynced(),
                node.isVersionUpToDate()
            ]
        }))
        await Promise.all(jobs)
    } catch (error) {
        await handleError(error)
    }
}).start()