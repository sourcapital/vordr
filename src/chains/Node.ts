export abstract class Node {
    protected url: string

    /**
     * @param url - The node's URL
     * @protected
     */
    protected constructor(url: string) {
        this.url = url
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
}