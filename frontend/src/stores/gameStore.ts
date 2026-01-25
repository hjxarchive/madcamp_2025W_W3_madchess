import { create } from 'zustand'
import { GameState, Move, Piece, PieceColor, PieceType, squareToRowCol, parseUci } from '../types/game'

interface GameStoreState {
  gameState: GameState | null
  selectedSquare: { row: number; col: number } | null
  legalMoves: { row: number; col: number }[]
  previousBoard: (Piece | null)[][] | null

  // Actions
  setGameState: (state: GameState) => void
  updateBoard: (board: (Piece | null)[][]) => void
  selectSquare: (row: number, col: number) => void
  clearSelection: () => void
  setLegalMoves: (moves: { row: number; col: number }[]) => void
  makeMove: (move: Move) => void
  applyOpponentMove: (move: Move) => void
  addCapturedPiece: (color: PieceColor, piece: PieceType) => void
  rollbackMove: () => void
}

// 초기 빈 보드 생성
const createEmptyBoard = (): (Piece | null)[][] => {
  return Array(8).fill(null).map(() => Array(8).fill(null))
}

// 테스트용 초기 체스 보드 생성
const createInitialBoard = (): (Piece | null)[][] => {
  const board = createEmptyBoard()

  // 체스 배열 인덱스: board[0] = 8행(위), board[7] = 1행(아래)

  // 흑 기물 배치 (상단, 8행과 7행)
  board[0] = [
    { type: 'r', color: 'black' },  // a8
    { type: 'n', color: 'black' },  // b8
    { type: 'b', color: 'black' },  // c8
    { type: 'q', color: 'black' },  // d8 - 퀸 (검은색 칸)
    { type: 'k', color: 'black' },  // e8 - 킹
    { type: 'b', color: 'black' },  // f8
    { type: 'n', color: 'black' },  // g8
    { type: 'r', color: 'black' },  // h8
  ]
  board[1] = Array(8).fill(null).map(() => ({ type: 'p' as PieceType, color: 'black' as PieceColor }))

  // 백 기물 배치 (하단, 2행과 1행)
  board[6] = Array(8).fill(null).map(() => ({ type: 'p' as PieceType, color: 'white' as PieceColor }))
  board[7] = [
    { type: 'r', color: 'white' },  // a1
    { type: 'n', color: 'white' },  // b1
    { type: 'b', color: 'white' },  // c1
    { type: 'q', color: 'white' },  // d1 - 퀸 (흰색 칸)
    { type: 'k', color: 'white' },  // e1 - 킹
    { type: 'b', color: 'white' },  // f1
    { type: 'n', color: 'white' },  // g1
    { type: 'r', color: 'white' },  // h1
  ]

  return board
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: {
    roomId: 'test-room',
    white: {
      userId: 'white-player',
      username: 'White Player',
      rating: 1500,
      deckId: 'deck-1',
      color: 'white',
    },
    black: {
      userId: 'black-player',
      username: 'Black Player',
      rating: 1500,
      deckId: 'deck-2',
      color: 'black',
    },
    board: createInitialBoard(),
    currentTurn: 'white',
    moveCount: 0,
    pgn: '',
    status: 'playing',
    isCheck: false,
    capturedPieces: {
      white: [],
      black: [],
    },
  },
  selectedSquare: null,
  legalMoves: [],
  previousBoard: null,

  setGameState: (state) => set({ gameState: state }),

  updateBoard: (board) =>
    set((state) => ({
      gameState: state.gameState
        ? { ...state.gameState, board }
        : null,
    })),

  selectSquare: (row, col) =>
    set({ selectedSquare: { row, col } }),

  clearSelection: () =>
    set({ selectedSquare: null, legalMoves: [] }),

  setLegalMoves: (moves) =>
    set({ legalMoves: moves }),

  makeMove: (move) =>
    set((state) => {
      if (!state.gameState) return state

      // Save current board for potential rollback
      const previousBoard = state.gameState.board.map(row => [...row])

      const newBoard = state.gameState.board.map(row => [...row])
      const { from, to } = parseUci(move.uci)
      const { row: fromRow, col: fromCol } = squareToRowCol(from)
      const { row: toRow, col: toCol } = squareToRowCol(to)
      const piece = newBoard[fromRow][fromCol]

      // 이동 실행
      newBoard[toRow][toCol] = piece
      newBoard[fromRow][fromCol] = null

      // 턴 변경
      const newTurn = state.gameState.currentTurn === 'white' ? 'black' : 'white'

      return {
        gameState: {
          ...state.gameState,
          board: newBoard,
          currentTurn: newTurn,
          moveCount: state.gameState.moveCount + 1,
          lastMove: move,
        },
        selectedSquare: null,
        legalMoves: [],
        previousBoard, // Save for rollback
      }
    }),

  applyOpponentMove: (move) =>
    set((state) => {
      if (!state.gameState) return state

      const newBoard = state.gameState.board.map(row => [...row])
      const { from, to } = parseUci(move.uci)
      const { row: fromRow, col: fromCol } = squareToRowCol(from)
      const { row: toRow, col: toCol } = squareToRowCol(to)
      const piece = newBoard[fromRow][fromCol]

      // 상대 기물 이동
      newBoard[toRow][toCol] = piece
      newBoard[fromRow][fromCol] = null

      // 캡처된 기물 기록
      let newCapturedPieces = { ...state.gameState.capturedPieces }
      if (move.captured) {
        const capturingColor = state.gameState.currentTurn
        newCapturedPieces[capturingColor] = [...newCapturedPieces[capturingColor], move.captured]
      }

      // 턴 변경 (내 차례로)
      const newTurn = state.gameState.currentTurn === 'white' ? 'black' : 'white'

      console.log('Opponent move applied:', move)

      return {
        gameState: {
          ...state.gameState,
          board: newBoard,
          currentTurn: newTurn,
          moveCount: state.gameState.moveCount + 1,
          lastMove: move,
          capturedPieces: newCapturedPieces,
        },
        selectedSquare: null,
        legalMoves: [],
      }
    }),

  addCapturedPiece: (color, piece) =>
    set((state) => {
      if (!state.gameState) return state

      return {
        gameState: {
          ...state.gameState,
          capturedPieces: {
            ...state.gameState.capturedPieces,
            [color]: [...state.gameState.capturedPieces[color], piece],
          },
        },
      }
    }),

  rollbackMove: () =>
    set((state) => {
      if (!state.gameState || !state.previousBoard) return state

      // Restore previous board state and toggle turn back
      const previousTurn = state.gameState.currentTurn === 'white' ? 'black' : 'white'

      return {
        gameState: {
          ...state.gameState,
          board: state.previousBoard,
          currentTurn: previousTurn,
          moveCount: Math.max(0, state.gameState.moveCount - 1),
        },
        previousBoard: null,
      }
    }),
}))

// 테스트용 헬퍼 함수: 콘솔에서 상대의 수를 시뮬레이션할 수 있음
export const simulateOpponentMove = (move: Move) => {
  console.log('Simulating opponent move:', move)
  const store = useGameStore.getState()
  store.applyOpponentMove(move)
}
