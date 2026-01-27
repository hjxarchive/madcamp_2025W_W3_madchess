// 체스 기물 타입
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type PieceColor = 'white' | 'black'

// 체스 좌표 (파일: a-h, 랭크: 1-8)
export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface Square {
  file: File
  rank: Rank
}

// 좌표 변환 유틸
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
// const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export const rowColToSquare = (row: number, col: number): Square => {
  return {
    file: FILES[col],
    rank: (8 - row) as Rank
  }
}

export const squareToRowCol = (square: Square): { row: number; col: number } => {
  const col = FILES.indexOf(square.file)
  const row = 8 - square.rank
  return { row, col }
}

// UCI 변환 유틸
export const squareToUci = (square: Square): string => {
  return `${square.file}${square.rank}`
}

export const uciToSquare = (uci: string): Square => {
  return {
    file: uci[0] as File,
    rank: parseInt(uci[1]) as Rank
  }
}

export const moveToUci = (from: Square, to: Square, promotion?: PieceType): string => {
  const uci = `${squareToUci(from)}${squareToUci(to)}`
  return promotion ? `${uci}${promotion}` : uci
}

export const parseUci = (uci: string): { from: Square; to: Square; promotion?: PieceType } => {
  const from = uciToSquare(uci.substring(0, 2))
  const to = uciToSquare(uci.substring(2, 4))
  const promotion = uci.length === 5 ? uci[4] as PieceType : undefined
  return { from, to, promotion }
}

// 체스 기물 인터페이스
export interface Piece {
  type: PieceType
  color: PieceColor
}

// 기물 점수
export const PIECE_COSTS: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

// 기물 최대 개수
export const PIECE_MAX_COUNT: Record<PieceType, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
}

// 배치 기물 인터페이스 (좌표 포함)
export interface PlacedPiece {
  type: PieceType
  file: File
  rank: Rank
}

// 배치 데이터 (WebSocket 전송용)
export interface PlacementData {
  color: PieceColor
  placement: PlacedPiece[]
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
  picture?: string
}

// 이동 인터페이스 (UCI 표기법)
export interface Move {
  uci: string  // UCI 표기법: "e2e4", "e7e8q" (프로모션 포함)
  piece: PieceType
  captured?: PieceType
  playerId?: string  // 누가 이동했는지 식별 (WebSocket 처리용)
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
