import {Bitcoin, Chain} from './Bitcoin.js'

export class Litecoin extends Bitcoin {
    constructor(url: string) {
        super(url, Chain.Litecoin)
    }
}