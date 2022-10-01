export abstract class Node {
    protected host: string

    protected constructor(host: string) {
        this.host = host
    }

    abstract isUp(): Promise<boolean>
    abstract isSynced(): Promise<boolean>
    abstract isVersionUpToDate(): Promise<boolean>
    protected abstract query(method: string, host?: string, params?: []): Promise<any>
}