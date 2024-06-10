export const config = {
    nodeENV: process.env.NODE_ENV,
    betterStack: {
        uptime: {
            apiKey: process.env.BETTERSTACK_API_KEY
        },
        logs: {
            sourceToken: process.env.LOGS_SOURCE_TOKEN
        },
    },
    thornodeAddress: process.env.THORNODE_ADDRESS!,
    nodeEndpoint: {
        thornode: process.env.NODE_ENDPOINT_THORNODE!,
        thorchain: process.env.NODE_ENDPOINT_THORCHAIN!,
        bitcoin: process.env.NODE_ENDPOINT_BITCOIN!,
        ethereum: process.env.NODE_ENDPOINT_ETHEREUM!,
        litecoin: process.env.NODE_ENDPOINT_LITECOIN!,
        bitcoinCash: process.env.NODE_ENDPOINT_BITCOIN_CASH!,
        dogecoin: process.env.NODE_ENDPOINT_DOGECOIN!,
        cosmos: process.env.NODE_ENDPOINT_COSMOS!,
        avalanche: process.env.NODE_ENDPOINT_AVALANCHE!,
        binanceSmart: process.env.NODE_ENDPOINT_BINANCE_SMART!
    }
}
