export const handleError = async (error: unknown) => {
    if (error instanceof Error) {
        await log.error(error.stack ? error.stack : error.message)
    } else if (typeof error === 'string') {
        await log.error(error.toUpperCase())
    } else {
        console.log(error)
        await log.error('Unkown error! Please check the logs.')
    }
}
