import {Ethereum, Chain} from './Ethereum.js'

export class BinanceSmart extends Ethereum {
    constructor(url: string) {
        super(url, Chain.BinanceSmart)
    }
}
