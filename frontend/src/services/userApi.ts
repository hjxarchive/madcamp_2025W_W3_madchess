import apiClient from './api'
import type {
    ApiResponse,
    User,
    UserStats,
    DeckWithStats,
    UserGame,
    UserGamesResponse,
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
export const getUserGames = async (userId: number, limit: number = 20, offset: number = 0): Promise<ApiResponse<UserGamesResponse>> => {
    const response = await apiClient.get<ApiResponse<UserGamesResponse>>(`/api/users/${userId}/games`, {
        params: { limit, offset }
    })
    return response.data
}

/**
 * Update user info
 * PATCH /api/users/:userId
 */
export const updateUser = async (userId: number, username: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.patch<ApiResponse<User>>(`/api/users/${userId}`, { username })
    return response.data
}
