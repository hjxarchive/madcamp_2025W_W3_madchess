// 체스 기물 타입
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type PieceColor = 'white' | 'black'

// 체스 기물 인터페이스
export interface Piece {
  type: PieceType
  color: PieceColor
}

// 덱 구성 인터페이스
export interface DeckComposition {
  p: number // 폰 (0-8)
  n: number // 나이트 (0-2)
  b: number // 비숍 (0-2)
  r: number // 룩 (0-2)
  q: number // 퀸 (0-1)
}

export interface Deck {
  id: string
  name: string
  userId: string
  composition: DeckComposition
  totalCost: number
  wins: number
  losses: number
}

// 플레이어 정보
export interface PlayerInfo {
  userId: string
  username: string
  rating: number
  deckId: string
  color: PieceColor
}

// 이동 인터페이스
export interface Move {
  from: { row: number; col: number }
  to: { row: number; col: number }
  piece: PieceType
  captured?: PieceType
}

// 게임 상태
export interface GameState {
  roomId: string
  white: PlayerInfo
  black: PlayerInfo
  board: (Piece | null)[][]
  currentTurn: PieceColor
  moveCount: number
  pgn: string
  status: 'placement' | 'playing' | 'checkmate' | 'resignation' | 'draw'
  isCheck: boolean
  lastMove?: Move
  capturedPieces: {
    white: PieceType[]
    black: PieceType[]
  }
}

// 게임 결과
export interface GameResult {
  winner: PieceColor | 'draw'
  reason: 'checkmate' | 'resignation' | 'timeout' | 'draw'
  whiteRatingChange: number
  blackRatingChange: number
}
