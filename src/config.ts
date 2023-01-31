export const config = {
    thornodeAddress: process.env.THORNODE_ADDRESS,
    logtail: {
        sourceToken: process.env.LOGTAIL_SOURCE_TOKEN,
    },
    betterUptime: {
        apiKey: process.env.BETTERUPTIME_API_KEY!,
    },
    nodeENV: process.env.NODE_ENV,
}