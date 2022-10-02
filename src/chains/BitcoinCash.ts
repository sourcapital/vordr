import {Bitcoin, Chain} from './Bitcoin.js'

export class BitcoinCash extends Bitcoin {
    constructor(url: string, port: number, username: string, password: string) {
        super(url, port, username, password, Chain.BitcoinCash)
    }
}