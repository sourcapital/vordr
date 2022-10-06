import {Cosmos, Chain} from './Cosmos.js'

export class Binance extends Cosmos {
    constructor(url: string) {
        super(url, 3, Chain.Binance)
    }
}