import {Ethereum, Chain} from './Ethereum.js'

export class Avalanche extends Ethereum {
    constructor(host: string) {
        super(host, Chain.Avalanche)
    }
}