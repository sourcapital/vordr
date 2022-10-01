import {Logtail} from '@logtail/node'
import {config} from './config.js'
import {Log} from './helpers/Log.js'
import {Bitcoin} from './helpers/Bitcoin.js'
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
*/

const node = new Binance(
    'https://binance.ninerealms.com',
    27147
)

const isUp = await node.isUp()
const isSynced = await node.isSynced()
const isVersionUpToDate = await node.isVersionUpToDate()