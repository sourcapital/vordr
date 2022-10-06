import {Bitcoin, Chain} from './Bitcoin.js'

export class BitcoinCash extends Bitcoin {
    constructor(url: string) {
        super(url, Chain.BitcoinCash)
    }
}