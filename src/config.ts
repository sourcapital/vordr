export const config = {
    logtail: {
        apiKey: process.env.LOGTAIL_API_KEY!,
    },
    mongo: {
        // connectionString: process.env.MONGO_DB_URL!,
    },
    nodeENV: process.env.NODE_ENV!,
}