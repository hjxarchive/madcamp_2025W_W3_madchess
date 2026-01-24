import axios, { AxiosInstance, AxiosError } from 'axios'

// API Base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add any auth tokens or custom headers here if needed
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => {
        return response
    },
    (error: AxiosError) => {
        // Handle common errors
        if (error.response) {
            // Server responded with error status
            console.error('API Error:', error.response.status, error.response.data)
        } else if (error.request) {
            // Request was made but no response received
            console.error('Network Error: No response from server')
        } else {
            // Something else happened
            console.error('Error:', error.message)
        }
        return Promise.reject(error)
    }
)

export default apiClient
