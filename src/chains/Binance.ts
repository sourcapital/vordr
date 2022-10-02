import {Cosmos, Chain} from './Cosmos.js'

export class Binance extends Cosmos {
    constructor(url: string, port: number) {
        super(url, port, Chain.Binance)
    }
}