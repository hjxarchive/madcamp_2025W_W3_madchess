export interface Card {
  id: string
  name: string
  type: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'
  cost: number
  attack: number
  defense: number
  movement: string
  special?: string
  description?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface Deck {
  id: string
  name: string
  cards: DeckCard[]
}

export interface DeckCard {
  cardId: string
  quantity: number
}

export interface Player {
  id: string
  username: string
  deckId: string
}

export interface GameState {
  matchId: string
  players: Player[]
  currentTurn: string
  board: (Piece | null)[][]
  status: 'waiting' | 'in_progress' | 'completed'
}

export interface Piece {
  id: string
  cardId: string
  playerId: string
  position: { row: number; col: number }
  attack: number
  defense: number
  hasMoved: boolean
}

export interface Move {
  from: { row: number; col: number }
  to: { row: number; col: number }
  pieceId: string
}
