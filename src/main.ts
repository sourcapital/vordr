import {Logtail} from '@logtail/node'
import {config} from './config.js'
import {Log} from './helpers/Log.js'
import {Bitcoin, Chain as Fork} from './helpers/Bitcoin.js'
import {Ethereum, Chain as EvmChain} from './helpers/Ethereum.js'
import {Cosmos, Chain as AppChain} from './helpers/Cosmos.js'

// Setup logger
global.log = new Log(
    new Logtail(config.logtail.apiKey)
)

/*
const node = new Bitcoin(
    'https://bitcoin.ninerealms.com',
    8332,
    'thorchain',
    'password'
)

const node = new Bitcoin(
    'https://litecoin.ninerealms.com',
    9332,
    'thorchain',
    'password',
    Fork.Litecoin
)

const node = new Bitcoin(
    'https://bitcoin-cash.ninerealms.com',
    8332,
    'thorchain',
    'password',
    Fork.BitcoinCash
)

const node = new Bitcoin(
    'https://dogecoin.ninerealms.com',
    22555,
    'thorchain',
    'password',
    Fork.Dogecoin
)

const node = new Ethereum(
    'https://ethereum.ninerealms.com',
    8545
)

const node = new Ethereum(
    'https://avalanche.ninerealms.com/ext/bc/C/rpc',
    9650,
    EvmChain.Avalanche
)

const node = new Cosmos(
    'https://gaia.ninerealms.com',
    26657
)

const node = new Cosmos(
    'https://binance.ninerealms.com',
    27147,
    AppChain.Binance
)
*/

const node = new Ethereum(
    'https://ethereum.ninerealms.com',
    8545
)

const isUp = await node.isUp()
const isSynced = await node.isSynced()
const isVersionUpToDate = await node.isVersionUpToDate()