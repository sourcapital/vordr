export const config = {
    thornodeAddress: process.env.THORNODE_ADDRESS,
    betterStack: {
        uptime: {
            apiKey: process.env.BETTERSTACK_API_KEY!
        },
        logs: {
            sourceToken: process.env.LOGS_SOURCE_TOKEN
        },
    },
    nodeENV: process.env.NODE_ENV,
}
