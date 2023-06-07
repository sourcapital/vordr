import {Ethereum, Chain} from './Ethereum.js'

export class BinanceSmartChain extends Ethereum {
    constructor(url: string) {
        super(url, Chain.BinanceSmartChain)
    }
}