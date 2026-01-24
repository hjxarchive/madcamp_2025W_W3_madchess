import apiClient from './api'
import type {
    ApiResponse,
    Deck,
    CreateDeckRequest,
    UpdateDeckRequest,
    ValidateDeckRequest,
    ValidateDeckResponse,
} from '../types/api.types'

/**
 * Create a new deck
 * POST /api/decks
 */
export const createDeck = async (deckData: CreateDeckRequest): Promise<ApiResponse<Deck>> => {
    const response = await apiClient.post<ApiResponse<Deck>>('/api/decks', deckData)
    return response.data
}

/**
 * Get deck by ID
 * GET /api/decks/:deckId
 */
export const getDeckById = async (deckId: number): Promise<ApiResponse<Deck>> => {
    const response = await apiClient.get<ApiResponse<Deck>>(`/api/decks/${deckId}`)
    return response.data
}

/**
 * Update deck
 * PUT /api/decks/:deckId
 */
export const updateDeck = async (
    deckId: number,
    updateData: UpdateDeckRequest
): Promise<ApiResponse<Deck>> => {
    const response = await apiClient.put<ApiResponse<Deck>>(`/api/decks/${deckId}`, updateData)
    return response.data
}

/**
 * Delete deck
 * DELETE /api/decks/:deckId
 */
export const deleteDeck = async (deckId: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/api/decks/${deckId}`)
    return response.data
}

/**
 * Validate deck composition
 * POST /api/decks/validate
 */
export const validateDeck = async (
    deckData: ValidateDeckRequest
): Promise<ApiResponse<ValidateDeckResponse>> => {
    const response = await apiClient.post<ApiResponse<ValidateDeckResponse>>(
        '/api/decks/validate',
        deckData
    )
    return response.data
}
