export const config = {
    logtail: {
        apiKey: process.env.LOGTAIL_API_KEY!,
    },
    heartBeat: {
        webHookUrl: process.env.HEARTBEAT_WEBHOOK_URL!,
    },
    nodeENV: process.env.NODE_ENV!,
}