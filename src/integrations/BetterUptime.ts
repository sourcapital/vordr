import _ from 'underscore'
import moment from 'moment'
import numeral from 'numeral'
import {config} from '../config.js'
import {Cron} from '../helpers/Cron.js'
import axios, {AxiosResponse} from 'axios'
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
    SLASH_POINTS = 'Slash Points',
    JAIL = 'Jail',
    CHAIN_OBSERVATION = 'Chain Observation'
}

export class BetterUptime {
    private readonly apiKey: string
    private cache: Map<string, number> = new Map()

    constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    async setupCleanup(schedule: string) {
        if (config.nodeENV !== 'production') return

        await log.info(`${BetterUptime.name}: Setup cleanup ...`)

        new Cron(schedule, async () => {
            const incidents = await this.getIncidents(undefined, true, false)

            for (const incident of incidents) {
                const daysInAge = moment().diff(moment(incident.attributes.started_at), 'days')

                if (daysInAge > 7) {
                    await this.deleteIncident(incident.id)
                }
            }

            this.cache.clear()

            await log.info(`${BetterUptime.name}: Cleaned!`)
        }).run()
    }

    async initHeartbeats(name: string, types: Array<HeartbeatType>) {
        if (config.nodeENV !== 'production') return

        const existingHeartbeats = await this.getHeartbeats()

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
        const identifier = `${name} ${IncidentType.RESTART}`
        let previousRestarts = this.cache.get(identifier)

        if (previousRestarts === undefined) {
            const incidents = await this.getIncidents(identifier, undefined, true)
            const latestIncident = _.last(incidents)
            previousRestarts = latestIncident ? Number(/total: ([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0
            this.cache.set(identifier, previousRestarts)
        }

        if (restartCount > previousRestarts) {
            await this.createIncident(
                `${name} ${IncidentType.RESTART}`,
                `${name} pod restarted! (total: ${numeral(restartCount).format('0')})`
            )
            this.cache.set(identifier, restartCount)
        }
    }

    async createSlashPointIncident(name: string, slashPoints: number, threshold: number) {
        const identifier = `${name} ${IncidentType.SLASH_POINTS}`
        let previousSlashPoints = this.cache.get(identifier)

        if (previousSlashPoints === undefined) {
            const incidents = await this.getIncidents(identifier, undefined, true)
            const latestIncident = _.last(incidents)
            previousSlashPoints = latestIncident ? Number(/([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0
            this.cache.set(identifier, previousSlashPoints)
        }

        if (slashPoints > threshold && slashPoints > 2 * previousSlashPoints) {
            await this.createIncident(
                `${name} ${IncidentType.SLASH_POINTS}`,
                `${name} has accumulated ${numeral(slashPoints).format('0')} slash points!`
            )
            this.cache.set(identifier, slashPoints)
        }
    }

    async createJailIncident(name: string, reason: string, releaseHeight: number) {
        const identifier = `${name} ${IncidentType.JAIL}`
        let previousReleaseHeight = this.cache.get(identifier)

        if (previousReleaseHeight === undefined) {
            const incidents = await this.getIncidents(identifier, undefined, true)
            const latestIncident = _.last(incidents)
            previousReleaseHeight = latestIncident ? Number(/releaseHeight = ([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0
            this.cache.set(identifier, previousReleaseHeight)
        }

        if (releaseHeight > previousReleaseHeight) {
            await this.createIncident(
                `${name} ${IncidentType.JAIL}`,
                `${name} has been jailed! (releaseHeight = ${numeral(releaseHeight).format('0')}, reason = '${reason}')`
            )
            this.cache.set(identifier, releaseHeight)
        }
    }

    async createChainObservationIncident(name: string, blocksBehind: number) {
        const identifier = `${name} ${IncidentType.CHAIN_OBSERVATION}`
        let previousBlocksBehind = this.cache.get(identifier)

        if (previousBlocksBehind === undefined) {
            const incidents = await this.getIncidents(identifier, undefined, true)
            const latestIncident = _.last(incidents)
            previousBlocksBehind = latestIncident ? Number(/([0-9]+)/g.exec(latestIncident.attributes.cause)![1]) : 0
            this.cache.set(identifier, previousBlocksBehind)
        }

        if (blocksBehind > 2 * previousBlocksBehind) {
            await this.createIncident(
                `${name} ${IncidentType.CHAIN_OBSERVATION}`,
                `${name} is ${numeral(blocksBehind).format('0')} blocks behind the latest observation of the network!`
            )
            this.cache.set(identifier, blocksBehind)
        }
    }

    private async resolveIncident(id: string) {
        await log.debug(`${BetterUptime.name}: Resolving incident: ${id}`)
        await this.send('POST', `incidents/${id}/resolve`)
    }

    async resolveIncidents(name: string, type: IncidentType) {
        if (config.nodeENV !== 'production') return

        let incidents = await this.getIncidents(`${name} ${type}`, false, false)

        for (const incident of incidents) {
            await this.resolveIncident(incident.id)
        }
    }

    private async deleteIncident(id: string) {
        await log.debug(`${BetterUptime.name}: Deleting incident: ${id}`)
        await this.send('DELETE', `incidents/${id}`)
    }

    async deleteIncidents(name: string, type: IncidentType) {
        let incidents = await this.getIncidents(`${name} ${type}`, undefined, false)

        for (const incident of incidents) {
            await this.deleteIncident(incident.id)
        }
    }

    async deleteAllIncidents() {
        const incidents = await this.getIncidents(undefined, undefined, false)

        for (const incident of incidents) {
            await this.deleteIncident(incident.id)
        }
    }

    async deleteAllHeartbeats() {
        let heartbeats = await this.getHeartbeats()

        for (const heartbeat of heartbeats) {
            await log.debug(`${BetterUptime.name}: Deleting heartbeat: '${heartbeat.attributes.name}'`)
            await this.send('DELETE', `heartbeats/${heartbeat.id}`)
        }
    }

    async deleteAllHeartbeatGroups() {
        const heartbeatGroups = await this.getHeartbeatGroups()

        for (const heartbeatGroup of heartbeatGroups) {
            await log.debug(`${BetterUptime.name}: Deleting heartbeat group: '${heartbeatGroup.attributes.name}'`)
            await this.send('DELETE', `heartbeat-groups/${heartbeatGroup.id}`)
        }
    }

    async deleteAll() {
        await this.deleteAllHeartbeats()
        await this.deleteAllHeartbeatGroups()
        await this.deleteAllIncidents()
    }

    private async getHeartbeats(): Promise<Array<Heartbeat>> {
        let response = await this.send('GET', 'heartbeats')

        let heartbeats: Array<Heartbeat> = []
        let nextPageUrl = undefined

        do {
            if (nextPageUrl) {
                response = await this.send('GET', 'heartbeats', undefined, nextPageUrl)
            }
            heartbeats = _.union(heartbeats, response.data.data)
            nextPageUrl = response.data.pagination.next
        } while (nextPageUrl)

        return heartbeats
    }

    private async getHeartbeat(name: string, type: HeartbeatType): Promise<Heartbeat> {
        const heartbeats = await this.getHeartbeats()
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
                email: false,
                push: true
            })
            heartbeat = response.data.data as Heartbeat
        }

        return heartbeat
    }

    private async getHeartbeatGroups(): Promise<Array<HeartbeatGroup>> {
        let response = await this.send('GET', 'heartbeat-groups')

        let heartbeatGroups: Array<HeartbeatGroup> = []
        let nextPageUrl = undefined

        do {
            if (nextPageUrl) {
                response = await this.send('GET', 'heartbeat-groups', undefined, nextPageUrl)
            }
            heartbeatGroups = _.union(heartbeatGroups, response.data.data)
            nextPageUrl = response.data.pagination.next
        } while (nextPageUrl)

        return heartbeatGroups
    }

    private async getHeartbeatGroup(name: string): Promise<HeartbeatGroup> {
        const groups = await this.getHeartbeatGroups()
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
                email: false,
                push: true
            })
        } catch (error) {
            await handleError(error)
        }
    }

    async getIncidents(title?: string, resolved?: boolean, returnEarly: boolean = true): Promise<Array<Incident>> {
        let response = await this.send('GET', 'incidents', {
            from: '1970-01-01',
            to: moment().format('YYYY-MM-DD')
        })

        let incidents: Array<Incident> = []
        let nextPageUrl = undefined

        do {
            await log.debug(`${BetterUptime.name}:${this.getIncidents.name}: title='${title}', resolved='${resolved}', returnEarly='${returnEarly}', nextPageUrl=${nextPageUrl}`)

            if (nextPageUrl) {
                response = await this.send('GET', 'incidents', undefined, nextPageUrl)
            }
            incidents = _.union(incidents, _.filter(response.data.data, (incident) => {
                const isResolved = incident.attributes.resolved_at != undefined
                const matchTitle = title ? incident.attributes.name === title : true
                const matchResolved = resolved !== undefined ? isResolved == resolved : true
                return matchTitle && matchResolved
            }))
            nextPageUrl = response.data.pagination.next
        } while (nextPageUrl && (returnEarly ? incidents.length === 0 : true)) // Return early if matching incidents are found

        // Sort by date
        incidents = _.sortBy(incidents, (incident) => {
            return incident.attributes.started_at
        })

        return incidents
    }

    private async send(method: string, endpoint: string, data?: object, nextPageUrl?: string): Promise<AxiosResponse> {
        let response = undefined

        while (true) {
            try {
                const url = nextPageUrl ? nextPageUrl : `https://betteruptime.com/api/v2/${endpoint}`

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