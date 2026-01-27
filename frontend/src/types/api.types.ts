// API Response Types

export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: {
        code: string
        message: string
    }
}

// User Types
export interface User {
    id: number
    username: string
    name?: string
    email?: string
    picture?: string
    rating: number
    createdAt: string
}

export interface UserStats {
    totalGames: number
    wins: number
    losses: number
    draws: number
    winRate: number
    currentWinStreak: number
    longestWinStreak: number
    recentGames: RecentGame[]
}

export interface RecentGame {
    gameId: number
    opponent: string
    result: 'WIN' | 'LOSE' | 'DRAW'
    ratingChange: number
    playedAt: string
}

// Deck Types
export interface PlacedPiece {
    type: string  // 'k', 'q', 'r', 'b', 'n', 'p'
    position: string  // 'e1', 'a2', etc.
}

export interface Deck {
    id: number
    name: string
    userId: number
    placement: PlacedPiece[]
    totalCost: number
    createdAt: string
    updatedAt?: string
}

export interface DeckWithStats extends Deck {
    winCnt: number
    loseCnt: number
    winRate: number
}

export interface CreateDeckRequest {
    userId: number
    name: string
    placement: PlacedPiece[]
}

export interface UpdateDeckRequest {
    name?: string
    placement?: PlacedPiece[]
}

export interface ValidateDeckRequest {
    placement: PlacedPiece[]
}

export interface ValidateDeckResponse {
    valid: boolean
    errors?: string[]
}

// Piece Types
export interface Piece {
    id: number
    name: string
    type: string
    value: number
    action: string
    maxCount: number
    description: string
    imgUrl: string
}

export interface PieceDetail extends Piece {
    movePattern?: number[][]
    specialRules?: string[]
}

// Game Types
export interface CreateGameRequest {
    player1Id: number
    player2Id: number
    deckId1: number
    deckId2: number
}

export interface GamePlayer {
    userId: number
    username: string
    rating: number
    deckId: number
}

export interface Game {
    id: number
    player1: GamePlayer
    player2: GamePlayer
    status: string
    currentTurn: string
    pgn: string
    isCheck: boolean
    createdAt: string
}

export interface ResignGameRequest {
    userId: number
}

export interface UserGame {
    gameId: number
    opponent: string
    result: 'WIN' | 'LOSE' | 'DRAW'
    ratingChange: number
    playedAt: string
}

export interface UserGamesResponse {
    total: number
    games: UserGame[]
}
