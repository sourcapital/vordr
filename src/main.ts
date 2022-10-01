import {Bitcoin} from './helpers/Bitcoin.js'
import {config} from './config.js'
import {Logtail} from '@logtail/node'
import {Log} from './helpers/Log.js'

// Setup logger
global.log = new Log(
    new Logtail(config.logtail.apiKey)
)

const bitcoin = new Bitcoin(
    'https://bitcoin.ninerealms.com',
    8332,
    'thorchain',
    'password'
)

const isUpBTC = await bitcoin.isUp()
const isSyncedBTC = await bitcoin.isSynced()
const isVersionUpToDateBTC = await bitcoin.isVersionUpToDate()