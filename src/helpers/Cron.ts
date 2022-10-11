import {CronJob} from 'cron'
import {handleError} from './Error.js'

export class Cron {
    private schedule: string
    private payload: () => void

    constructor(schedule: string, payload: () => void) {
        this.schedule = schedule
        this.payload = payload
    }

    run() {
        new CronJob(this.schedule, async () => {
            try {
                await this.payload()
            } catch (error) {
                await handleError(error)
            }
        }).start()
    }
}