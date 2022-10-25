import _ from 'underscore'
import moment from 'moment'
import numeral from 'numeral'
import axios, {AxiosResponse} from 'axios'
import {config} from '../config.js'
import {handleError} from '../helpers/Error.js'

declare type Heartbeat = {
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

declare type HeartbeatGroup = {
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

declare type Incident = {
    id: string,
    type: string,
    attributes: {
        name: string,
        url: string,
        cause: string,
        started_at: string,
        resolved_at: string,
        call: boolean
        sms: boolean,
        email: boolean
        push: boolean,
    }
}

export enum HeartbeatType {
    HEALTH = 'Health',
    SYNC_STATUS = 'Sync Status',
    VERSION = 'Version'
}

export enum IncidentType {
    RESTART = 'Restart',
    DISK_USAGE = 'Disk Usage',
    SLASH_POINTS = 'Slash Points',
    JAIL = 'Jail'
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
                await log.debug(`${BetterUptime.name}: Heartbeat already created: '${name} ${type}'`)
            }
        }
    }

    async sendHeartbeat(name: string, type: HeartbeatType) {
        if (config.nodeENV !== 'production') return

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

    async createRestartIncident(name: string, restartCount: number) {
        const incidents = await this.getAllIncidents(`${name} ${IncidentType.RESTART}`, false)
        const latestIncident = _.first(incidents.reverse())
        const previousRestarts = latestIncident ? Number(/total: ([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0

        if (restartCount > previousRestarts) {
            await this.createIncident(
                `${name} ${IncidentType.RESTART}`,
                `${name} pod restarted! (total: ${numeral(restartCount).format('0')})`
            )
        }
    }

    async createDiskUsageIncident(name: string, usedBytes: number, totalBytes: number, threshold: number) {
        const incidents = await this.getAllIncidents(`${name} ${IncidentType.DISK_USAGE}`, false)
        const latestIncident = _.first(incidents.reverse())
        const previousDiskUsage = latestIncident ? Number(/\(([0-9]+)%\)/g.exec(latestIncident.attributes.cause)![1]) / 100 : 0
        const diskUsage = usedBytes / totalBytes

        if (diskUsage > threshold && diskUsage > 1.05 * previousDiskUsage) {
            await this.createIncident(
                `${name} ${IncidentType.DISK_USAGE}`,
                `${name} pod has high disk usage: ${numeral(usedBytes).format('0.0b')} / ${numeral(totalBytes).format('0.0b')} (${numeral(diskUsage).format('0%')})`
            )
        }
    }

    async createSlashPointIncident(name: string, slashPoints: number, threshold: number) {
        const incidents = await this.getAllIncidents(`${name} ${IncidentType.SLASH_POINTS}`, false)
        const latestIncident = _.first(incidents.reverse())
        const previousSlashPoints = latestIncident ? Number(/([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0

        if (slashPoints > threshold && slashPoints > 1.5 * previousSlashPoints) {
            await this.createIncident(
                `${name} ${IncidentType.SLASH_POINTS}`,
                `${name} has accumulated ${numeral(slashPoints).format('0')} slash points!`
            )
        }
    }

    async createJailIncident(name: string, reason: string, releaseHeight: number) {
        const incidents = await this.getAllIncidents(`${name} ${IncidentType.JAIL}`, false)
        const latestIncident = _.first(incidents.reverse())
        const previousReleaseHeight = latestIncident ? Number(/releaseHeight = ([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0

        if (releaseHeight > previousReleaseHeight) {
            await this.createIncident(
                `${name} ${IncidentType.JAIL}`,
                `${name} has been jailed! (releaseHeight = ${numeral(releaseHeight).format('0')}, reason = '${reason}')`
            )
        }
    }

    async deleteAll() {
        await this.deleteAllHeartbeats()
        await this.deleteAllHeartbeatGroups()
        await this.deleteAllIncidents()
    }

    async deleteAllHeartbeats() {
        let heartbeats = await this.getAllHeartbeats()

        for (const heartbeat of heartbeats) {
            await log.debug(`${BetterUptime.name}: Deleting heartbeat: '${heartbeat.attributes.name}'`)
            await this.send('DELETE', `heartbeats/${heartbeat.id}`)
        }
    }

    async deleteAllHeartbeatGroups() {
        const heartbeatGroups = await this.getAllHeartbeatGroups()

        for (const heartbeatGroup of heartbeatGroups) {
            await log.debug(`${BetterUptime.name}: Deleting heartbeat group: '${heartbeatGroup.attributes.name}'`)
            await this.send('DELETE', `heartbeat-groups/${heartbeatGroup.id}`)
        }
    }

    async deleteAllIncidents() {
        const incidents = await this.getAllIncidents(undefined, false)

        for (const incident of incidents) {
            await this.deleteIncident(incident.id)
        }
    }

    async resolveIncidents(name: string, type: IncidentType) {
        let incidents = await this.getAllIncidents(`${name} ${type}`, true)

        for (const incident of incidents) {
            await this.resolveIncident(incident.id)
        }
    }

    async deleteIncidents(name: string, type: IncidentType) {
        let incidents = await this.getAllIncidents(`${name} ${type}`, false)

        for (const incident of incidents) {
            await this.deleteIncident(incident.id)
        }
    }

    private async deleteIncident(id: string) {
        await log.debug(`${BetterUptime.name}: Deleting incident: ${id}`)
        await this.send('DELETE', `incidents/${id}`)
    }

    private async resolveIncident(id: string) {
        await log.debug(`${BetterUptime.name}: Resolving incident: ${id}`)
        await this.send('POST', `incidents/${id}/resolve`)
    }

    private async getHeartbeat(name: string, type: HeartbeatType): Promise<Heartbeat> {
        const heartbeats = await this.getAllHeartbeats()
        let heartbeat = _.first(_.filter(heartbeats, (heartbeat) => {
            return heartbeat.attributes.name === `${name} ${type}`
        }))

        const group = await this.getHeartbeatGroup(name)

        if (!heartbeat) {
            await log.debug(`${BetterUptime.name}: Creating new heartbeat: '${name} ${type}'`)

            // Create new heartbeat
            const response = await this.send('POST', 'heartbeats', {
                name: `${name} ${type}`,
                period: 60, // 1min
                grace: 300, // 5min
                heartbeat_group_id: group.id,
                email: true,
                push: true
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
            await log.debug(`${BetterUptime.name}: Creating new heartbeat group: '${name}'`)

            // Create new heartbeat group
            const response = await this.send('POST', 'heartbeat-groups', {
                name: name
            })
            group = response.data.data as HeartbeatGroup
        }

        return group
    }

    private async createIncident(name: string, summary: string) {
        if (config.nodeENV !== 'production') return

        try {
            await this.send('POST', 'incidents', {
                requester_email: 'vordr@vordr.vordr',
                name: name,
                summary: summary,
                email: true,
                push: true
            })
        } catch (error) {
            await handleError(error)
        }
    }

    private async getAllHeartbeats(): Promise<Array<Heartbeat>> {
        const response = await this.send('GET', 'heartbeats')
        return response.data.data
    }

    private async getAllHeartbeatGroups(): Promise<Array<HeartbeatGroup>> {
        const response = await this.send('GET', 'heartbeat-groups')
        return response.data.data
    }

    private async getAllIncidents(title?: string, unresolvedOnly: boolean = true): Promise<Array<Incident>> {
        const response = await this.send('GET', 'incidents', {
            from: '1970-01-01',
            to: moment().format('YYYY-MM-DD')
        })

        let incidents = response.data.data
        if (title) {
            incidents = _.filter(incidents, (incident) => {
                return incident.attributes.name === title
            })
        }
        if (unresolvedOnly) {
            incidents = _.filter(incidents, (incident) => {
                return !incident.attributes.resolved_at
            })
        }
        incidents = _.sortBy(incidents, (incident) => {
            return incident.attributes.started_at
        })

        return incidents
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
                if (endpoint.match(/^incidents\/[0-9]+\/resolve/g)) {
                    httpCode = 200
                } else if (method === 'POST') {
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