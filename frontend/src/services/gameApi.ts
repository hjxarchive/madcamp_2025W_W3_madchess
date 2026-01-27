import apiClient from './api'
import type {
    ApiResponse,
    Game,
    CreateGameRequest,
    ResignGameRequest,
} from '../types/api.types'

/**
 * Create a new game
 * POST /api/games
 */
export const createGame = async (gameData: CreateGameRequest): Promise<ApiResponse<Game>> => {
    const response = await apiClient.post<ApiResponse<Game>>('/api/games', gameData)
    return response.data
}

/**
 * Get game state by ID
 * GET /api/games/:gameId
 */
export const getGameById = async (gameId: number): Promise<ApiResponse<Game>> => {
    const response = await apiClient.get<ApiResponse<Game>>(`/api/games/${gameId}`)
    return response.data
}

/**
 * Resign from game
 * POST /api/games/:gameId/resign
 */
export const resignGame = async (
    gameId: number,
    resignData: ResignGameRequest
): Promise<ApiResponse<Game>> => {
    const response = await apiClient.post<ApiResponse<Game>>(
        `/api/games/${gameId}/resign`,
        resignData
    )
    return response.data
}

/**
 * Get game replay history
 * GET /api/games/:gameId/replay
 */
export const getGameReplay = async (gameId: string | number): Promise<ApiResponse<any[]>> => {
    const response = await apiClient.get<ApiResponse<any> & { history: any[] }>(`/api/games/${gameId}/replay`)
    // Server returns { success, history: [] }
    if (response.data.success && (response.data as any).history) {
        return {
            ...response.data,
            data: (response.data as any).history
        }
    }
    return response.data as unknown as ApiResponse<any[]>
}
