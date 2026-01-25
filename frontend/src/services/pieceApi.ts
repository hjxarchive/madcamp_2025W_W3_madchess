import apiClient from './api'
import type { ApiResponse, Piece, PieceDetail } from '../types/api.types'

/**
 * Get all pieces
 * GET /api/pieces
 */
export const getAllPieces = async (): Promise<ApiResponse<Piece[]>> => {
    const response = await apiClient.get<ApiResponse<Piece[]>>('/api/pieces')
    return response.data
}

/**
 * Get piece detail by ID
 * GET /api/pieces/:pieceId
 */
export const getPieceById = async (pieceId: number): Promise<ApiResponse<PieceDetail>> => {
    const response = await apiClient.get<ApiResponse<PieceDetail>>(`/api/pieces/${pieceId}`)
    return response.data
}
