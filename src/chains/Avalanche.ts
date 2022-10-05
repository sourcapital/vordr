import {Ethereum, Chain} from './Ethereum.js'

export class Avalanche extends Ethereum {
    constructor(url: string) {
        super(url, 1, Chain.Avalanche)
    }
}