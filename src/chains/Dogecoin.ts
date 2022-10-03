import {Bitcoin, Chain} from './Bitcoin.js'

export class Dogecoin extends Bitcoin {
    constructor(url: string) {
        super(url, Chain.Dogecoin)
    }
}