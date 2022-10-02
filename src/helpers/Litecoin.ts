import {Bitcoin, Chain} from './Bitcoin.js'

export class Litecoin extends Bitcoin {
    constructor(url: string, port: number, username: string, password: string) {
        super(url, port, username, password, Chain.Litecoin)
    }
}