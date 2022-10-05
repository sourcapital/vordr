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
let nodes: [Thornode, Binance, Bitcoin, Ethereum, Litecoin, BitcoinCash, Dogecoin, Cosmos, Avalanche]
if (config.nodeENV === 'production') {
    nodes = [
        new Thornode('http://thornode:1317', 'http://thornode:27147'),
        new Binance('http://binance-daemon:27147'),
        new Bitcoin('http://thorchain:password@bitcoin-daemon:8332'),
        new Ethereum('http://ethereum-daemon:8545'),
        new Litecoin('http://thorchain:password@litecoin-daemon:9332'),
        new BitcoinCash('http://thorchain:password@bitcoin-cash-daemon:8332'),
        new Dogecoin('http://thorchain:password@dogecoin-daemon:22555'),
        new Cosmos('http://gaia-daemon:26657'),
        new Avalanche('http://avalanche-daemon:9650')
    ]
} else {
    nodes = [
        new Thornode('https://thornode.ninerealms.com', 'https://rpc.ninerealms.com'),
        new Binance('https://binance.ninerealms.com'),
        new Bitcoin('thorchain:password@https://bitcoin.ninerealms.com'),
        new Ethereum('https://ethereum.ninerealms.com'),
        new Litecoin('thorchain:password@https://litecoin.ninerealms.com'),
        new BitcoinCash('thorchain:password@https://bitcoin-cash.ninerealms.com'),
        new Dogecoin('thorchain:password@https://dogecoin.ninerealms.com'),
        new Cosmos('https://gaia.ninerealms.com'),
        new Avalanche('https://avalanche.ninerealms.com/ext/bc/C/rpc')
    ]
}

// Init heartbeats in correct sequence
await log.info('Initializing heartbeats ...')
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