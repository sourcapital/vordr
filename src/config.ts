export const config = {
    logtail: {
        apiKey: process.env.LOGTAIL_API_KEY,
    },
    betterUptime: {
        apiKey: process.env.BETTERUPTIME_API_KEY!,
    },
    nodeENV: process.env.NODE_ENV,
}