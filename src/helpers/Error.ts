export const handleError = async (error: unknown, raise: boolean = false) => {
    if (error instanceof Error) {
        await log.error(error.stack ? error.stack : error.message, raise)
    } else if (typeof error === 'string') {
        await log.error(error.toUpperCase(), raise)
    } else {
        console.log(error)
        await log.error('Unkown error! Please check the logs.', raise)
    }
}