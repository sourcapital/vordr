export abstract class Node {
    protected url: string
    protected port: number

    protected constructor(url: string, port: number) {
        this.url = url
        this.port = port
    }

    abstract isUp(): Promise<boolean>
    abstract isSynced(): Promise<boolean>
    abstract isVersionUpToDate(): Promise<boolean>
}