export const handleError = async (error: unknown, raise: boolean = false) => {
    if (typeof error === 'string') {
        await log.error(error.toUpperCase(), raise)
    } else if (error instanceof Error) {
        await log.error(error.message, raise)
    } else {
        console.log(error)
        await log.error('Unkown error! Please check the logs.', raise)
    }
}