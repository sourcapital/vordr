import {Ethereum, Chain} from './Ethereum.js'

export class Avalanche extends Ethereum {
    constructor(host: string, port: number) {
        super(host, port, Chain.Avalanche)
    }
}