import { ChessService } from './ChessService'

interface QueuePlayer {
  socketId: string
  userId: string
  deckId: string
  timeControl: string
  username?: string
  picture?: string
  rating?: number
}

interface PlacementData {
  color: 'white' | 'black'
  placement: Array<{ type: string; file: string; rank: number }>
}

interface Match {
  id: string
  player1SocketId: string
  player2SocketId: string
  player1: { userId: string; deckId: string; color: 'white' | 'black'; username?: string; picture?: string; rating?: number }
  player2: { userId: string; deckId: string; color: 'white' | 'black'; username?: string; picture?: string; rating?: number }
  player1Color: 'white' | 'black'
  player2Color: 'white' | 'black'
  standardPgn: string
  player1Placement?: Array<{ type: string; file: string; rank: number }>
  player2Placement?: Array<{ type: string; file: string; rank: number }>
  whitePlacement?: Array<{ type: string; file: string; rank: number }>
  blackPlacement?: Array<{ type: string; file: string; rank: number }>
  gameState: any
  chessEngine: ChessService

  // Timer State
  whiteTime: number // ms
  blackTime: number // ms
  lastMoveTime?: number
  timeControl: {
    limit: number // seconds
    increment: number // seconds
    label: string
  }
  isAI?: boolean
  aiDifficulty?: number // 0-20
}

// Room interface for room-based matchmaking
interface Room {
  code: string
  matchId: string
  hostSocketId: string
  guestSocketId?: string
  host: { userId: string; deckId: string; color: 'white' | 'black'; username?: string; picture?: string; rating?: number }
  guest?: { userId: string; deckId: string; color: 'white' | 'black'; username?: string; picture?: string; rating?: number }
  status: 'waiting' | 'ready' | 'in_progress'
  createdAt: number
}

import { StockfishService } from './StockfishService'

export class GameManager {
  private queue: QueuePlayer[] = []
  private matches: Map<string, Match> = new Map()
  private rooms: Map<string, Room> = new Map() // Room code -> Room
  private spectators: Map<string, Set<string>> = new Map() // matchId -> Set of socketIds
  private stockfishService: StockfishService
  private broadcastCallback?: (matchId: string, event: string, data: any) => void

  constructor() {
    this.stockfishService = new StockfishService()
  }

  setBroadcastCallback(callback: (matchId: string, event: string, data: any) => void) {
    this.broadcastCallback = callback
  }

  async analyzeGame(matchId: string): Promise<{ type: 'cp' | 'mate', value: number, bestMove?: string }> {
    const match = this.matches.get(matchId)
    if (!match) throw new Error('Match not found')

    const fen = match.chessEngine.getFEN()
    const result = await this.stockfishService.evaluate(fen)

    // Score is relative to side-to-move. Convert to absolute (white-relative).
    if (match.chessEngine.getTurn() === 'black') {
      result.value = -result.value
    }

    return result
  }

  async analyzeFen(fen: string): Promise<{ type: 'cp' | 'mate', value: number, bestMove?: string }> {
    const result = await this.stockfishService.evaluate(fen)

    // FEN usually includes side-to-move at parts[1]
    const parts = fen.split(' ')
    if (parts.length > 1 && parts[1] === 'b') {
      result.value = -result.value
    }

    return result
  }

  // ===== Spectator Methods =====

  /**
   * Get list of live games for spectators
   */
  getLiveGames(): Array<{
    matchId: string;
    white: { username: string; rating: number };
    black: { username: string; rating: number };
    timeControl: string;
    spectatorCount: number;
    currentTurn: 'white' | 'black';
    board: any;
    whiteTime: number;
    blackTime: number;
    lastMoveTime?: number;
  }> {
    const liveGames: Array<{
      matchId: string;
      white: { username: string; rating: number };
      black: { username: string; rating: number };
      timeControl: string;
      spectatorCount: number;
      currentTurn: 'white' | 'black';
      board: any;
      whiteTime: number;
      blackTime: number;
      lastMoveTime?: number;
    }> = []

    for (const [matchId, match] of this.matches.entries()) {
      // Only include games that are in 'playing' status
      if (match.gameState?.status === 'playing') {
        const whitePlayer = match.player1Color === 'white' ? match.player1 : match.player2
        const blackPlayer = match.player1Color === 'black' ? match.player1 : match.player2

        liveGames.push({
          matchId,
          white: {
            username: whitePlayer.username || 'Player',
            rating: whitePlayer.rating || 1500,
          },
          black: {
            username: blackPlayer.username || 'Player',
            rating: blackPlayer.rating || 1500,
          },
          timeControl: match.timeControl.label,
          spectatorCount: this.spectators.get(matchId)?.size || 0,
          currentTurn: match.gameState.currentTurn,
          board: match.gameState.board,
          whiteTime: match.whiteTime,
          blackTime: match.blackTime,
          lastMoveTime: match.lastMoveTime
        })
      }
    }

    return liveGames
  }

  /**
   * Get full game state for a spectator joining mid-game
   */
  getGameStateForSpectator(matchId: string): {
    gameState: any;
    whiteTime: number;
    blackTime: number;
    white: { username: string; rating: number };
    black: { username: string; rating: number };
    timeControl: string;
    pgn: string;
    lastMoveTime?: number;
  } | null {
    const match = this.matches.get(matchId)
    if (!match) return null

    const whitePlayer = match.player1Color === 'white' ? match.player1 : match.player2
    const blackPlayer = match.player1Color === 'black' ? match.player1 : match.player2

    return {
      gameState: match.gameState,
      whiteTime: match.whiteTime,
      blackTime: match.blackTime,
      lastMoveTime: match.lastMoveTime,
      white: {
        username: whitePlayer.username || 'Player',
        rating: whitePlayer.rating || 1500,
      },
      black: {
        username: blackPlayer.username || 'Player',
        rating: blackPlayer.rating || 1500,
      },
      timeControl: match.timeControl.label,
      pgn: match.standardPgn || '',
    }
  }

  /**
   * Add a spectator to a match
   */
  addSpectator(matchId: string, socketId: string): boolean {
    if (!this.matches.has(matchId)) return false

    if (!this.spectators.has(matchId)) {
      this.spectators.set(matchId, new Set())
    }
    this.spectators.get(matchId)!.add(socketId)
    console.log(`👁️ Spectator ${socketId} joined ${matchId}. Total: ${this.spectators.get(matchId)!.size}`)
    return true
  }

  /**
   * Remove a spectator from a match
   */
  removeSpectator(matchId: string, socketId: string): void {
    const spectatorSet = this.spectators.get(matchId)
    if (spectatorSet) {
      spectatorSet.delete(socketId)
      console.log(`👁️ Spectator ${socketId} left ${matchId}. Remaining: ${spectatorSet.size}`)
      if (spectatorSet.size === 0) {
        this.spectators.delete(matchId)
      }
    }
  }

  /**
   * Remove spectator from all matches (on disconnect)
   */
  removeSpectatorFromAll(socketId: string): void {
    for (const [matchId, spectatorSet] of this.spectators.entries()) {
      if (spectatorSet.has(socketId)) {
        spectatorSet.delete(socketId)
        if (spectatorSet.size === 0) {
          this.spectators.delete(matchId)
        }
      }
    }
  }

  addToQueue(socketId: string, userId: string, deckId: string, timeControl: string = '3+0', username?: string, picture?: string, rating?: number) {
    this.queue.push({ socketId, userId, deckId, timeControl, username, picture, rating })
  }

  getCastlingOptions(matchId: string, color: 'white' | 'black') {
    const match = this.matches.get(matchId)
    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    const options = match.chessEngine.getFreestyleCastlingOptions(color)
    console.log(`♜ Castling options for ${color} in ${matchId}:`, options)
    return { success: true, options }
  }

  removeFromQueue(socketId: string) {
    this.queue = this.queue.filter(player => player.socketId !== socketId)
  }

  tryMatchPlayers(): Match | null {
    if (this.queue.length < 2) {
      return null
    }

    // Group by time control
    const groups: { [key: string]: QueuePlayer[] } = {}

    for (const p of this.queue) {
      if (!groups[p.timeControl]) groups[p.timeControl] = []
      groups[p.timeControl].push(p)
    }

    // Find first group with >= 2 players
    for (const tc in groups) {
      if (groups[tc].length >= 2) {
        const player1 = groups[tc][0]
        const player2 = groups[tc][1]

        // Remove these two from queue
        this.queue = this.queue.filter(p => p.socketId !== player1.socketId && p.socketId !== player2.socketId)

        // Parse Time Control
        const [limitStr, incStr] = tc.split('+')
        const limit = parseInt(limitStr) * 60 // minutes to seconds
        const increment = parseInt(incStr)

        const matchId = `match-${Date.now()}`
        const chessEngine = new ChessService()

        const match: Match = {
          id: matchId,
          player1SocketId: player1.socketId,
          player2SocketId: player2.socketId,
          player1: { userId: player1.userId, deckId: player1.deckId, color: 'white', username: player1.username, picture: player1.picture, rating: player1.rating },
          player2: { userId: player2.userId, deckId: player2.deckId, color: 'black', username: player2.username, picture: player2.picture, rating: player2.rating },
          player1Color: 'white',
          player2Color: 'black',
          chessEngine,
          gameState: this.initializeGame(
            matchId,
            { userId: player1.userId, username: player1.username || 'Player 1', rating: player1.rating || 1500, deckId: player1.deckId, color: 'white', picture: player1.picture },
            { userId: player2.userId, username: player2.username || 'Player 2', rating: player2.rating || 1500, deckId: player2.deckId, color: 'black', picture: player2.picture }
          ),

          // Timer Setup
          timeControl: { limit, increment, label: tc },
          whiteTime: limit * 1000, // ms
          blackTime: limit * 1000, // ms
          standardPgn: '',
        }

        this.matches.set(matchId, match)
        return match
      }
    }

    return null
  }

  // Reconnect player to match (update socket ID)
  reconnectPlayer(matchId: string, userId: string, newSocketId: string): { success: boolean; match?: Match; error?: string; playerColor?: 'white' | 'black' } {
    const match = this.matches.get(matchId)
    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    let playerColor: 'white' | 'black' | undefined

    const stringifiedUserId = String(userId)

    if (String(match.player1.userId) === stringifiedUserId) {
      match.player1SocketId = newSocketId
      playerColor = match.player1Color
    } else if (String(match.player2.userId) === stringifiedUserId) {
      match.player2SocketId = newSocketId
      playerColor = match.player2Color
    } else {
      return { success: false, error: 'User not in this match' }
    }

    // Check if next turn is AI
    const nextTurnColor = match.chessEngine.getTurn() // 'white' or 'black'

    // If next player is AI, trigger AI move
    if (match.isAI) {
      // Check if it's really AI's turn
      const isAiTurn = (nextTurnColor === match.player1Color && match.player1SocketId === 'ai') ||
        (nextTurnColor === match.player2Color && match.player2SocketId === 'ai')

      if (isAiTurn && !match.gameState.isCheckmate && !match.gameState.isDraw) {
        setTimeout(() => this.makeAIMove(matchId), 1500) // 1.5s delay for realism
      }
    }

    return {
      success: true,
      match,
      playerColor
    }
  }

  submitPlacement(matchId: string, socketId: string, placementData: PlacementData): { success?: boolean; waiting?: boolean; error?: string } {
    const match = this.matches.get(matchId)
    if (!match) {
      return { error: 'Match not found' }
    }

    // 플레이어 식별
    const isPlayer1 = match.player1SocketId === socketId
    const isPlayer2 = match.player2SocketId === socketId

    if (!isPlayer1 && !isPlayer2 && socketId !== 'ai') { // Allow AI to submit placement
      return { error: 'Player not in match' }
    }

    // 플레이어별 색상 결정 (서버 신뢰)
    const expectedColor: 'white' | 'black' = isPlayer1 ? match.player1Color : match.player2Color

    // 배치 정보 저장 (플레이어/색상 모두 기록)
    if (isPlayer1) {
      match.player1Placement = placementData.placement
    } else {
      match.player2Placement = placementData.placement
    }

    if (expectedColor === 'white') {
      match.whitePlacement = placementData.placement
    } else {
      match.blackPlacement = placementData.placement
    }

    // 양쪽 모두 배치 완료 확인 (색상 기준)
    if (match.player1Placement && match.player2Placement) {
      this.startGame(matchId)
      return { success: true } // Return success immediately after starting game
    }

    return { waiting: true }
  }

  private startGame(matchId: string) {
    const match = this.matches.get(matchId)
    if (!match) return

    // Initialize chess engine with correct color placements
    match.chessEngine.initializeFromPlacement(match.whitePlacement!, match.blackPlacement!)
    console.log('✅ Chess engine initialized with custom placements (white/black mapped)')

    // Get board and reverse it for frontend compatibility (Rank 8 at index 0)
    const engineBoard = match.chessEngine.getBoard()
    const frontendBoard = [...engineBoard].reverse()

    // Debug logging for initial board
    console.log(`🎬 Game Start - Match ${matchId}`)
    console.log(`⚪ White: ${match.whitePlacement?.length} pieces, Black: ${match.blackPlacement?.length} pieces`)
    console.log(`🎯 Rank 1 Piece at f1:`, engineBoard[0][5]?.color, engineBoard[0][5]?.type)
    console.log(`🎯 Rank 2 Piece at f2:`, engineBoard[1][5]?.color, engineBoard[1][5]?.type)

    // Reset turn to white at game start & Sync Board
    match.gameState = {
      ...match.gameState,
      currentTurn: 'white',
      board: frontendBoard,
      status: 'playing',
      initialFen: match.chessEngine.getFEN(),
      capturedPieces: { white: [], black: [] }
    }

    // Start Timer
    match.lastMoveTime = Date.now()

    // If AI is to move first, trigger AI move
    if (match.isAI) {
      const nextTurnColor = match.chessEngine.getTurn() // 'white' or 'black'

      const isAiTurn = (nextTurnColor === match.player1Color && match.player1SocketId === 'ai') ||
        (nextTurnColor === match.player2Color && match.player2SocketId === 'ai')

      if (isAiTurn) {
        setTimeout(() => this.makeAIMove(matchId), 1500) // 1.5s delay for realism
      }
    }
  }

  getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId)
  }

  getMatchPGN(matchId: string): string | undefined {
    const match = this.matches.get(matchId)
    if (!match) return undefined

    // For simplicity, we'll store PGN as:
    // JSON(whitePlacement)|JSON(blackPlacement)|move1 move2 move3...
    const whitePlacementStr = JSON.stringify(match.player1Placement)
    const blackPlacementStr = JSON.stringify(match.player2Placement)
    const movesStr = match.chessEngine.getPGN()

    return `${whitePlacementStr}|${blackPlacementStr}|${match.standardPgn || ''}`
  }

  makeMove(matchId: string, socketId: string, move: any): {
    success: boolean
    gameState?: any
    error?: string
    isCheck?: boolean
    isCheckmate?: boolean
    isStalemate?: boolean
    isDraw?: boolean
    drawReason?: string
    winner?: string
    moverColor?: string
    whiteTime?: number
    blackTime?: number
  } {
    const match = this.matches.get(matchId)
    if (!match) {
      console.log(`❌ Match not found: ${matchId}`)
      return { success: false, error: 'Match not found' }
    }

    // Parse UCI move (e.g., "e2e4" or "e7e8q")
    if (!move.uci || move.uci.length < 4) {
      console.log(`❌ Invalid move format:`, move)
      return { success: false, error: 'Invalid move format' }
    }

    // Validate requester color matches current turn
    const isPlayer1 = match.player1SocketId === socketId
    const requesterColor = isPlayer1 ? match.player1Color : match.player2Color

    if (requesterColor !== match.gameState.currentTurn) {
      return { success: false, error: 'Not your turn' }
    }

    // Time Control Logic
    if (match.lastMoveTime) {
      const now = Date.now()
      const elapsed = now - match.lastMoveTime

      if (match.gameState.currentTurn === 'white') {
        match.whiteTime -= elapsed
        if (match.whiteTime <= 0) {
          match.whiteTime = 0
          return {
            success: false,
            error: 'Time out',
            winner: 'black',
            drawReason: 'timeout',
            whiteTime: 0,
            blackTime: match.blackTime
          }
        }
        match.whiteTime += match.timeControl.increment * 1000
      } else {
        match.blackTime -= elapsed
        if (match.blackTime <= 0) {
          match.blackTime = 0
          return {
            success: false,
            error: 'Time out',
            winner: 'white',
            drawReason: 'timeout',
            whiteTime: match.whiteTime,
            blackTime: 0
          }
        }
        match.blackTime += match.timeControl.increment * 1000
      }
      match.lastMoveTime = now
    }

    const from = move.uci.substring(0, 2)
    const to = move.uci.substring(2, 4)
    const promotion = move.uci.length === 5 ? move.uci[4] : undefined

    console.log(`🔍 Validating move: ${from} -> ${to}${promotion ? ` (promotion: ${promotion})` : ''}`)

    return this.processMove(matchId, socketId, { from, to, promotion })
  }

  async makeAIMove(matchId: string) {
    const match = this.matches.get(matchId)
    if (!match || !match.isAI) return

    try {
      // Get FEN
      const fen = match.chessEngine.getFEN()

      // Use Stockfish to find best move
      // Difficulty handling: We can set Skill Level or depth. 
      // For now let's just use depth but maybe random sub-optimal moves?
      // StockfishService uses 'depth' param. 
      // Let's map difficulty 1-10 to depth 1-10.
      const depth = Math.max(1, Math.min(10, match.aiDifficulty || 5))

      const result = await this.stockfishService.evaluate(fen, depth)

      if (result.bestMove) {
        // Apply move
        // bestMove format: "e2e4"
        const from = result.bestMove.substring(0, 2)
        const to = result.bestMove.substring(2, 4)
        const promotion = result.bestMove.length > 4 ? result.bestMove.substring(4, 5) : undefined

        // We need to call processMove. But processMove expects socketId.
        // We can overload processMove or create internal method.
        // Let's call processMove with 'ai'.
        this.processMove(matchId, 'ai', { from, to, promotion })
      }
    } catch (e) {
      console.error('AI Move Error:', e)
    }
  }

  processMove(matchId: string, socketId: string, move: { from: string; to: string; promotion?: string }): {
    success: boolean
    gameState?: any
    error?: string
    isCheck?: boolean
    isCheckmate?: boolean
    isStalemate?: boolean
    isDraw?: boolean
    drawReason?: string
    winner?: string
    moverColor?: string
    whiteTime?: number
    blackTime?: number
  } {
    const match = this.matches.get(matchId)
    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    // Get piece info before move for broadcasting
    const moverPiece = match.chessEngine.getPieceAtUci(move.from)
    const capturedPiece = match.chessEngine.getPieceAtUci(move.to)

    // Use custom chess engine to validate move
    const result = match.chessEngine.makeMove(move.from, move.to, move.promotion)

    if (!result.success) {
      console.log(`❌ Move validation failed in match ${matchId}: ${move.from} -> ${move.to} (Piece: ${moverPiece?.type}, Color: ${moverPiece?.color}, Turn: ${match.chessEngine.getTurn()})`)
      return {
        success: false,
        error: 'Invalid move - 불법 이동입니다'
      }
    }

    // Determine winner if checkmate
    let winner: string | undefined
    if (result.isCheckmate) {
      const moverColor = match.player1SocketId === socketId ? match.player1Color : match.player2Color
      winner = moverColor
    }

    // Sync GameState from Engine and Update standardPgn
    const moverColor = match.player1SocketId === socketId ? match.player1Color : match.player2Color
    // We don't have algebraic yet, so use UCI space-separated for PGN logic
    const moveStr = `${move.from}${move.to}${move.promotion || ''}`

    if (moverColor === 'white') {
      const moveNumber = Math.floor(match.gameState.moveCount / 2) + 1
      if (match.standardPgn) {
        match.standardPgn += ` ${moveNumber}. ${moveStr}`
      } else {
        match.standardPgn = `1. ${moveStr}`
      }
    } else {
      match.standardPgn += ` ${moveStr}`
    }

    const engineBoard = match.chessEngine.getBoard()
    match.gameState = {
      ...match.gameState,
      board: [...engineBoard].reverse(),
      currentTurn: match.chessEngine.getTurn(),
      pgn: match.standardPgn,
      isCheck: result.isCheck,
      moveCount: match.gameState.moveCount + 1
    }

    // Update game status if game over
    if (result.isCheckmate) {
      match.gameState.status = 'checkmate'
    } else if (result.isStalemate) {
      match.gameState.status = 'draw' // Stalemate is a draw
    } else if (result.isDraw) {
      match.gameState.status = 'draw'
    }

    console.log(`✅ Move validated: ${moveStr}, Status: ${match.gameState.status}`)

    // If AI is enabled and it's AI's turn next, trigger AI move
    if (match.isAI) {
      const nextTurnColor = match.chessEngine.getTurn() // 'white' or 'black'

      const isAiTurn = (nextTurnColor === match.player1Color && match.player1SocketId === 'ai') ||
        (nextTurnColor === match.player2Color && match.player2SocketId === 'ai')

      if (isAiTurn && !result.isCheckmate && !result.isStalemate && !result.isDraw) {
        setTimeout(() => this.makeAIMove(matchId), 1500) // 1.5s delay for realism
      }
    }

    // Broadcast move if callback is available
    if (this.broadcastCallback) {
      const winner = result.isCheckmate ? (moverColor === 'white' ? 'white' : 'black') : (result.isDraw ? 'draw' : undefined)
      const reason = result.isCheckmate ? 'checkmate' : (result.isStalemate ? 'stalemate' : (result.isDraw ? result.drawReason : undefined))

      this.broadcastCallback(matchId, 'move-made', {
        matchId,
        move: {
          uci: moveStr,
          piece: moverPiece?.type,
          captured: capturedPiece?.type
        },
        socketId: socketId,
        moverColor,
        gameState: match.gameState,
        isCheck: result.isCheck,
        isCheckmate: result.isCheckmate,
        isStalemate: result.isStalemate,
        isDraw: result.isDraw,
        whiteTime: match.whiteTime,
        blackTime: match.blackTime,
        lastMoveTime: match.lastMoveTime
      })

      if (winner && reason) {
        this.broadcastCallback(matchId, 'game-over', { winner, reason })
      }
    }

    return {
      success: true,
      gameState: match.gameState,
      isCheck: result.isCheck,
      isCheckmate: result.isCheckmate,
      isStalemate: result.isStalemate,
      isDraw: result.isDraw,
      drawReason: result.drawReason,
      winner,
      moverColor,
      whiteTime: match.whiteTime,
      blackTime: match.blackTime
    }
  }

  getLegalMoves(matchId: string, socketId: string): { success: boolean; legalMoves?: Array<{ from: string; to: string; promotion?: string }>; gameState?: { isCheck: boolean; isCheckmate: boolean; isStalemate: boolean }; error?: string } {
    const match = this.matches.get(matchId)
    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    // Determine requester color
    let color: 'white' | 'black'
    if (match.player1SocketId === socketId) {
      color = match.player1Color
    } else if (match.player2SocketId === socketId) {
      color = match.player2Color
    } else if (socketId === 'ai') { // Allow AI to request legal moves
      color = match.player1SocketId === 'ai' ? match.player1Color : match.player2Color
    }
    else {
      return { success: false, error: 'Player not in match' }
    }

    const legalMoves = match.chessEngine.getLegalMovesForColor(color)
    const gameState = match.chessEngine.getCurrentGameState()
    return { success: true, legalMoves, gameState }
  }

  // ===== Room Management =====

  private generateRoomCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''

    // Generate a unique 6-character code
    do {
      code = ''
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length))
      }
    } while (this.rooms.has(code))

    return code
  }

  createAIGame(
    socketId: string,
    userId: string,
    deckId: string,
    color: 'white' | 'black' | 'random',
    difficulty: number,
    username?: string,
    picture?: string,
    rating?: number
  ): Match {
    const matchId = `ai-match-${Date.now()}`

    // Determine colors
    let player1Color: 'white' | 'black' = 'white'
    if (color === 'random') {
      player1Color = Math.random() < 0.5 ? 'white' : 'black'
    } else {
      player1Color = color as 'white' | 'black'
    }
    const player2Color = player1Color === 'white' ? 'black' : 'white'

    // AI Configuration
    const aiPlayer: any = {
      userId: 'ai-bot',
      deckId: 'standard-deck',
      color: player2Color,
      username: `Fairy Stockfish (Lv.${difficulty})`,
      picture: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Chess_Bot_Icon.png',
      rating: 1500 + (difficulty * 100)
    }

    const humanPlayer = {
      userId,
      deckId,
      color: player1Color,
      username: username || 'Player',
      picture: picture || '',
      rating: rating || 1200
    }

    // Generate Fair AI Placement (Max 30 points)
    const aiPlacement = this.generateFairAiPlacement(player2Color)

    const match: Match = {
      id: matchId,
      player1SocketId: socketId,
      player2SocketId: 'ai',
      player1: humanPlayer,
      player2: aiPlayer,
      player1Color,
      player2Color,
      standardPgn: '',
      gameState: {
        roomId: matchId,
        white: (player1Color === 'white' ? humanPlayer : aiPlayer) as any,
        black: (player1Color === 'black' ? humanPlayer : aiPlayer) as any,
        board: [],
        currentTurn: 'white',
        moveCount: 0,
        pgn: '',
        status: 'placement',
        isCheck: false,
        capturedPieces: { white: [], black: [] },
      },
      chessEngine: new ChessService(),
      whiteTime: 600 * 1000,
      blackTime: 600 * 1000,
      timeControl: { limit: 600, increment: 0, label: '10 min' },
      isAI: true,
      aiDifficulty: difficulty
    }

    // Set AI placement immediately
    if (player2Color === 'white') {
      match.whitePlacement = aiPlacement
      match.player2Placement = aiPlacement
    } else {
      match.blackPlacement = aiPlacement
      match.player2Placement = aiPlacement
    }

    this.matches.set(matchId, match)
    return match
  }

  /**
   * Generates a random piece placement for AI respecting the 30-point cost limit.
   */
  private generateFairAiPlacement(color: 'white' | 'black'): Array<{ type: string; file: string; rank: number }> {
    const COST_LIMIT = 30
    const MAX_PIECES = 16
    const costs: { [key: string]: number } = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9 }
    const fileMap = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    // Available slots: Rank 1 & 2 for White, Rank 8 & 7 for Black
    const slots: Array<{ file: string; rank: number }> = []
    const majorRank = color === 'white' ? 1 : 8
    const pawnRank = color === 'white' ? 2 : 7

    for (let i = 0; i < 8; i++) {
      slots.push({ file: fileMap[i], rank: majorRank })
      slots.push({ file: fileMap[i], rank: pawnRank })
    }

    // Shuffle slots
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    const queens = []
    // Always start with a King
    const kingSlot = slots.pop()!
    const placement = [{ type: 'k', file: kingSlot.file, rank: kingSlot.rank }]
    let currentCost = 0

    // Possible pieces to buy
    const shop = ['p', 'n', 'b', 'r', 'q']

    // Strategy: Ensure at least some minor pieces first, then fill with random
    // Guarantee 2 pawns, 1 knight, 1 bishop (Cost: 1+1+3+3 = 8)
    const guaranteed = ['p', 'p', 'n', 'b']
    for (const p of guaranteed) {
      if (slots.length > 0) {
        const slot = slots.pop()!
        placement.push({ type: p, file: slot.file, rank: slot.rank })
        currentCost += costs[p]
      }
    }

    // Fill remaining points with random selections
    while (currentCost < COST_LIMIT && slots.length > 0) {
      // Filter affordable pieces
      const affordable = shop.filter(p => currentCost + costs[p] <= COST_LIMIT)
      if (affordable.length === 0) break

      const pick = affordable[Math.floor(Math.random() * affordable.length)]
      const slot = slots.pop()!

      placement.push({ type: pick, file: slot.file, rank: slot.rank })
      currentCost += costs[pick]
    }

    return placement
  }

  createRoom(hostSocketId: string, userId: string, deckId: string, color: 'white' | 'black', username?: string, picture?: string, rating?: number): Room {
    const code = this.generateRoomCode()
    const matchId = `match-${Date.now()}`

    const room: Room = {
      code,
      matchId,
      hostSocketId,
      host: { userId, deckId, color, username, picture, rating },
      status: 'waiting',
      createdAt: Date.now(),
    }

    this.rooms.set(code, room)
    console.log(`✅ Room created: ${code} by ${userId}`)

    return room
  }

  /**
   * Update game status when game ends
   */
  endGame(matchId: string, result: { winner: string; reason: string }) {
    const match = this.matches.get(matchId)
    if (match) {
      console.log(`🏁 Ending game ${matchId}: ${result.winner} won by ${result.reason}`)

      // Update status so it doesn't show in live games
      match.gameState = {
        ...match.gameState,
        status: result.winner === 'draw' ? 'draw' : (result.reason === 'resignation' ? 'resignation' : (result.reason === 'timeout' ? 'timeout' : 'checkmate')),
        // Store result in gameState if needed for reconnects
        winner: result.winner,
        reason: result.reason
      }

      return true
    }
    return false
  }



  joinRoom(roomCode: string, guestSocketId: string, userId: string, deckId: string, username?: string, picture?: string, rating?: number): {
    success: boolean
    room?: Room
    error?: string
  } {
    const room = this.rooms.get(roomCode)

    if (!room) {
      return { success: false, error: '존재하지 않는 방입니다' }
    }

    if (room.status !== 'waiting') {
      return { success: false, error: '이미 게임이 시작된 방입니다' }
    }

    if (room.guestSocketId) {
      return { success: false, error: '방이 가득 찼습니다' }
    }

    // Guest color is opposite of host
    const guestColor: 'white' | 'black' = room.host.color === 'white' ? 'black' : 'white'

    room.guestSocketId = guestSocketId
    room.guest = { userId, deckId, color: guestColor, username, picture, rating }
    room.status = 'ready'

    // Create a match for this room
    const chessEngine = new ChessService()
    const match: Match = {
      id: room.matchId,
      player1SocketId: room.hostSocketId,
      player2SocketId: guestSocketId,
      player1: { userId: room.host.userId, deckId: room.host.deckId, color: room.host.color, username: room.host.username, picture: room.host.picture, rating: room.host.rating },
      player2: { userId, deckId, color: guestColor, username, picture, rating },
      player1Color: room.host.color,
      player2Color: guestColor,
      gameState: this.initializeGame(
        room.matchId,
        { userId: room.host.userId, username: room.host.username || 'Host', rating: room.host.rating || 1500, deckId: room.host.deckId, color: room.host.color, picture: room.host.picture },
        { userId: userId, username: username || 'Guest', rating: rating || 1500, deckId: deckId, color: guestColor, picture: picture }
      ),
      chessEngine,

      // Default Timer for Friendly Rooms: Rapid 10+0
      timeControl: { limit: 600, increment: 0, label: '10+0' },
      whiteTime: 600000,
      blackTime: 600000,
      standardPgn: '',
    }

    this.matches.set(room.matchId, match)

    console.log(`✅ Player ${userId} joined room ${roomCode}`)

    return { success: true, room }
  }

  leaveRoom(socketId: string): Room | null {
    // Find room containing this socket
    for (const [code, room] of this.rooms.entries()) {
      if (room.hostSocketId === socketId || room.guestSocketId === socketId) {
        // [MODIFIED] DON'T delete the match here. Let it persist for rejoining or game-over condition.
        // if (this.matches.has(room.matchId)) {
        //   this.matches.delete(room.matchId)
        // }

        // Delete the room
        this.rooms.delete(code)

        return room
      }
    }

    return null
  }

  handleDisconnect(socketId: string) {
    this.removeFromQueue(socketId)

    // Handle room disconnect
    this.leaveRoom(socketId)

    // [MODIFIED] DON'T delete matches on disconnect. 
    // This allows reconnection within the same session.
    // Matches should only be cleaned up when finished or via a global TTL.
    /*
    for (const [matchId, match] of this.matches.entries()) {
      if (match.player1SocketId === socketId || match.player2SocketId === socketId) {
        this.matches.delete(matchId)
      }
    }
    */
  }

  private initializeGame(roomId: string, white: any, black: any): any {
    // Initialize 8x8 chess board
    const board = Array(8).fill(null).map(() => Array(8).fill(null))

    return {
      roomId,
      white,
      black,
      board,
      currentTurn: 'white',
      moveCount: 0,
      pgn: '',
      status: 'playing', // or 'placement' depending on flow
      isCheck: false,
      capturedPieces: { white: [], black: [] },
    }
  }
}
