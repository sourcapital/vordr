import {Logtail} from '@logtail/node'
import {config} from './config.js'
import {Log} from './helpers/Log.js'
import {Bitcoin} from './helpers/Bitcoin.js'
import {Litecoin} from './helpers/Litecoin.js'
import {BitcoinCash} from './helpers/BitcoinCash.js'
import {Dogecoin} from './helpers/Dogecoin.js'
import {Ethereum} from './helpers/Ethereum.js'
import {Avalanche} from './helpers/Avalanche.js'
import {Cosmos} from './helpers/Cosmos.js'
import {Binance} from './helpers/Binance.js'
import {Thornode} from './helpers/Thornode.js'

// Setup logger
global.log = new Log(
    new Logtail(config.logtail.apiKey)
)

const nodes = [
    // new Bitcoin('https://bitcoin.ninerealms.com', 8332, 'thorchain', 'password'),
    // new Litecoin('https://litecoin.ninerealms.com', 9332, 'thorchain', 'password'),
    // new BitcoinCash('https://bitcoin-cash.ninerealms.com', 8332, 'thorchain', 'password'),
    // new Dogecoin('https://dogecoin.ninerealms.com', 22555, 'thorchain', 'password'),
    // new Ethereum('https://ethereum.ninerealms.com', 8545),
    // new Avalanche('https://avalanche.ninerealms.com/ext/bc/C/rpc', 9650),
    // new Cosmos('https://gaia.ninerealms.com', 26657),
    // new Binance('https://binance.ninerealms.com', 27147),
    new Thornode('https://thornode.ninerealms.com', 1317, 'https://rpc.ninerealms.com', 27147)
]

nodes.forEach(async (node) => {
    const isUp = await node.isUp()
    const isSynced = await node.isSynced()
    const isVersionUpToDate = await node.isVersionUpToDate()

    await log.info(`${node.constructor.name}: isUp = ${isUp} | isSynced = ${isSynced} | isVersionUpToDate = ${isVersionUpToDate}`)
})

/*
Ideas/Todos:
- Create a THORChain class that extends Cosmos to do further checks (thorchain version, slash points, churn, etc.)
- Add heart beat to external service (http call) -> BetterUptime
- Log health metrics and extract it in Logtails Grafana -> log.info({isUp, isSynced, isVersionUptoDate})
- Debug log how much each chain is behind, etc.
- Add docker file
- Add kubernetes deployment file
*/