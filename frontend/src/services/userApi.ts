import apiClient from './api'
import type {
    ApiResponse,
    User,
    UserStats,
    DeckWithStats,
    UserGame,
} from '../types/api.types'

/**
 * Create a new user
 * POST /api/users
 */
export const createUser = async (username: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>('/api/users', { username })
    return response.data
}

/**
 * Get user by ID
 * GET /api/users/:userId
 */
export const getUserById = async (userId: number): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>(`/api/users/${userId}`)
    return response.data
}

/**
 * Get user statistics
 * GET /api/users/:userId/stats
 */
export const getUserStats = async (userId: number): Promise<ApiResponse<UserStats>> => {
    const response = await apiClient.get<ApiResponse<UserStats>>(`/api/users/${userId}/stats`)
    return response.data
}

/**
 * Get user's decks
 * GET /api/users/:userId/decks
 */
export const getUserDecks = async (userId: number): Promise<ApiResponse<DeckWithStats[]>> => {
    const response = await apiClient.get<ApiResponse<DeckWithStats[]>>(`/api/users/${userId}/decks`)
    return response.data
}

/**
 * Get user's game history
 * GET /api/users/:userId/games
 */
export const getUserGames = async (userId: number): Promise<ApiResponse<UserGame[]>> => {
    const response = await apiClient.get<ApiResponse<UserGame[]>>(`/api/users/${userId}/games`)
    return response.data
}
