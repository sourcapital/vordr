import axios, {AxiosResponse} from 'axios'

axios.interceptors.response.use(
    (response) => {
        return response
    },
    async (error) => {
        if (error.response) {
            await log.error(`
                Error occurred for URL: ${error.config.url}\n
                Error status: ${error.response.status}\n
                Error headers: ${JSON.stringify(error.response.headers, null, 2)}
            `)
        } else {
            await log.error(`Error: ${error.message}`)
        }
        return Promise.reject(error)
    }
)

export const safeAxiosGet = async (url: string): Promise<AxiosResponse | undefined> => {
    try {
        return await axios.get(url)
    } catch (error) {
        return undefined
    }
}

export const safeAxiosPost = async (url: string, data: {}, config: {}): Promise<AxiosResponse | undefined> => {
    try {
        return await axios.post(url, data, config)
    } catch (error) {
        return undefined
    }
}
