import axios, {AxiosResponse} from 'axios'
import _ from 'underscore'
import {handleError} from '../helpers/Error.js'
import {config} from '../config.js'

export declare type Heartbeat = {
    id: string,
    type: string,
    attributes: {
        url: string,
        name: string,
        period: number,
        grace: number,
        call: boolean
        sms: boolean,
        email: boolean
        push: boolean,
        team_wait: boolean,
        heartbeat_group_id: string,
        sort_index: number,
        paused_at: string,
        created_at: string,
        updated_at: string,
        status: string
    }
}

export declare type HeartbeatGroup = {
    id: string,
    type: string,
    attributes: {
        name: string,
        sort_index: number,
        created_at: string,
        updated_at: string,
        paused: boolean
    }
}

export declare type Incident = {
    id: string
    type: string
}

export enum HeartbeatType {
    HEALTH = 'Health',
    SYNC_STATUS = 'Sync Status',
    VERSION = 'Version'
}

export class BetterUptime {
    private readonly apiKey: string

    constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    async initHeartbeats(name: string, types: Array<HeartbeatType>) {
        const existingHeartbeats = await this.getAllHeartbeats()

        for (const type of types) {
            const exists = _.find(existingHeartbeats, (existingHeartbeat) => {
                return existingHeartbeat.attributes.name === `${name} ${type}`
            })

            if (!exists) {
                // Create new heartbeat
                await this.getHeartbeat(name, type)
            } else {
                await log.debug(`${BetterUptime.name}:${this.send.name}: Heartbeat already created: '${name} ${type}'`)
            }
        }
    }

    async sendHeartbeat(name: string, type: HeartbeatType) {
        if (config.nodeENV !== 'production') {
            return
        }

        try {
            const heartbeat = await this.getHeartbeat(name, type)
            const response = await axios.get(heartbeat.attributes.url)

            if (response.status === 200) {
                await log.info(`Heartbeat:${name} ${type} ❤️`)
            } else {
                await log.error(`${BetterUptime.name}:${this.sendHeartbeat.name}: HTTP status code: ${response.status}`)
            }
        } catch (error) {
            await handleError(error)
        }
    }

    async deleteAll() {
        await this.deleteAllHeartbeats()
        await this.deleteAllHeartbeatGroups()
    }

    async deleteAllHeartbeats() {
        let heartbeats = await this.getAllHeartbeats()

        for (const heartbeat of heartbeats) {
            await log.debug(`${BetterUptime.name}:${this.send.name}: Deleting heartbeat: '${heartbeat.attributes.name}'`)
            await this.send('DELETE', `heartbeats/${heartbeat.id}`)
        }
    }

    async deleteAllHeartbeatGroups() {
        const heartbeatGroups = await this.getAllHeartbeatGroups()

        for (const heartbeatGroup of heartbeatGroups) {
            await log.debug(`${BetterUptime.name}:${this.send.name}: Deleting heartbeat group: '${heartbeatGroup.attributes.name}'`)
            await this.send('DELETE', `heartbeat-groups/${heartbeatGroup.id}`)
        }
    }

    async deleteAllIncidents() {
        let incidents = await this.getAllIncidents()

        while (incidents.length !== 0) {
            for (const incident of incidents) {
                await log.debug(`${BetterUptime.name}:${this.send.name}: Deleting incident: ${incident.id}`)
                await this.send('DELETE', `incidents/${incident.id}`)
            }
            incidents = await this.getAllIncidents()
        }
    }

    private async getHeartbeat(name: string, type: HeartbeatType): Promise<Heartbeat> {
        const heartbeats = await this.getAllHeartbeats()
        let heartbeat = _.first(_.filter(heartbeats, (heartbeat) => {
            return heartbeat.attributes.name === `${name} ${type}`
        }))

        const group = await this.getHeartbeatGroup(name)

        if (!heartbeat) {
            await log.debug(`${BetterUptime.name}:${this.send.name}: Creating new heartbeat: '${name} ${type}'`)

            // Create new heartbeat
            const response = await this.send('POST', 'heartbeats', {
                name: `${name} ${type}`,
                period: 60, // 1min
                grace: 300, // 5min
                heartbeat_group_id: group.id
            })

            heartbeat = response.data.data as Heartbeat
        }

        return heartbeat
    }

    private async getHeartbeatGroup(name: string): Promise<HeartbeatGroup> {
        const groups = await this.getAllHeartbeatGroups()
        let group = _.first(_.filter(groups, (group) => {
            return group.attributes.name === name
        }))

        if (!group) {
            await log.debug(`${BetterUptime.name}:${this.send.name}: Creating new heartbeat group: '${name}'`)

            // Create new heartbeat group
            const response = await this.send('POST', 'heartbeat-groups', {
                name: name
            })

            group = response.data.data as HeartbeatGroup
        }

        return group
    }

    private async getAllHeartbeats(): Promise<Array<Heartbeat>> {
        const response = await this.send('GET', 'heartbeats')
        return response.data.data
    }

    private async getAllHeartbeatGroups(): Promise<Array<HeartbeatGroup>> {
        const response = await this.send('GET', 'heartbeat-groups')
        return response.data.data
    }

    private async getAllIncidents(): Promise<Array<Incident>> {
        const response = await this.send('GET', 'incidents')
        return response.data.data
    }

    private async send(method: string, endpoint: string, data?: object): Promise<AxiosResponse> {
        let response = undefined

        while (true) {
            try {
                const url = `https://betteruptime.com/api/v2/${endpoint}`

                response = await axios.request({
                    url: url,
                    method: method,
                    data: data,
                    headers: {Authorization: `Bearer ${this.apiKey}`}
                })

                let httpCode: number
                if (method === 'POST') {
                    httpCode = 201
                } else if (method === 'DELETE') {
                    httpCode = 204
                } else {
                    httpCode = 200
                }

                if (response.status === httpCode) {
                    break
                } else {
                    await log.error(`${BetterUptime.name}:${this.send.name}: HTTP status code: ${response.status}`)
                }
            } catch (error) {
                await sleep(100)
            }
        }

        return response
    }
}