import {handleError} from './Error.js'
import axios, {AxiosResponse} from 'axios'

export const safeAxiosGet = async (url: string): Promise<AxiosResponse | undefined> => {
    try {
        return await axios.get(url)
    } catch (error) {
        await handleError(error)
        return undefined
    }
}

export const safeAxiosPost = async (url: string, data: {}, config: {}): Promise<AxiosResponse | undefined> => {
    try {
        return await axios.post(url, data, config)
    } catch (error) {
        await handleError(error)
        return undefined
    }
}
