import {Logtail} from '@logtail/node'
import {config} from './config.js'
import {Log} from './helpers/Log.js'
import {Bitcoin, Fork} from './helpers/Bitcoin.js'
import {Ethereum} from './helpers/Ethereum.js'
import {Binance} from './helpers/Binance.js'

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

const node = new Ethereum(
    'https://ethereum.ninerealms.com',
    8545
)

const node = new Binance(
    'https://binance.ninerealms.com',
    27147
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
*/

const node = new Bitcoin(
    'https://dogecoin.ninerealms.com',
    22555,
    'thorchain',
    'password',
    Fork.Dogecoin
)

const isUp = await node.isUp()
const isSynced = await node.isSynced()
const isVersionUpToDate = await node.isVersionUpToDate()