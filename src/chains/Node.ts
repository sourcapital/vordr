export abstract class Node {
    protected url: string

    protected constructor(url: string) {
        this.url = url
    }

    abstract initHeartbeats(): void
    abstract isUp(): Promise<boolean>
    abstract isSynced(): Promise<boolean>
    abstract isVersionUpToDate(): Promise<boolean>
}