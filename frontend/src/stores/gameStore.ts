import { create } from 'zustand'

interface GameState {
  gameId: string | null
  players: Array<{ id: string; name: string }>
  currentTurn: string | null
  board: any[][] // Chess board state
  setGameId: (id: string) => void
  setPlayers: (players: Array<{ id: string; name: string }>) => void
  setCurrentTurn: (playerId: string) => void
  updateBoard: (board: any[][]) => void
}

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  players: [],
  currentTurn: null,
  board: Array(8).fill(null).map(() => Array(8).fill(null)),
  setGameId: (id) => set({ gameId: id }),
  setPlayers: (players) => set({ players }),
  setCurrentTurn: (playerId) => set({ currentTurn: playerId }),
  updateBoard: (board) => set({ board }),
}))
