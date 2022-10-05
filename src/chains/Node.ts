export abstract class Node {
    protected url: string
    protected blockDelay: number

    /**
     * @param url - The node's URL
     * @param blockDelay - Amount of blocks the node is allowed to be behind because of network latency
     * @protected
     */
    protected constructor(url: string, blockDelay: number) {
        this.url = url
        this.blockDelay = blockDelay
    }

    /**
     * Initialize the node's heartbeats.
     */
    abstract initHeartbeats(): void

    /**
     * Check if the node is up and healthy.
     */
    abstract isUp(): Promise<boolean>

    /**
     * Check if the node is synced to the latest block height.
     */
    abstract isSynced(): Promise<boolean>

    /**
     * Check if the node's version is up-to-date.
     */
    abstract isVersionUpToDate(): Promise<boolean>
}