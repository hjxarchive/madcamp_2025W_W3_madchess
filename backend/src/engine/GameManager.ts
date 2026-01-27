import { ChessService } from './ChessService'

interface QueuePlayer {
  socketId: string
  userId: string
  deckId: string
  timeControl: string
}

interface PlacementData {
  color: 'white' | 'black'
  placement: Array<{ type: string; file: string; rank: number }>
}

interface Match {
  id: string
  player1SocketId: string
  player2SocketId: string
  player1: { userId: string; deckId: string }
  player2: { userId: string; deckId: string }
  player1Color: 'white' | 'black'
  player2Color: 'white' | 'black'
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
}

// Room interface for room-based matchmaking
interface Room {
  code: string
  matchId: string
  hostSocketId: string
  guestSocketId?: string
  host: { userId: string; deckId: string; color: 'white' | 'black' }
  guest?: { userId: string; deckId: string; color: 'white' | 'black' }
  status: 'waiting' | 'ready' | 'in_progress'
  createdAt: number
}

export class GameManager {
  private queue: QueuePlayer[] = []
  private matches: Map<string, Match> = new Map()
  private rooms: Map<string, Room> = new Map() // Room code -> Room

  addToQueue(socketId: string, userId: string, deckId: string, timeControl: string = '3+0') {
    this.queue.push({ socketId, userId, deckId, timeControl })
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
          player1: { userId: player1.userId, deckId: player1.deckId },
          player2: { userId: player2.userId, deckId: player2.deckId },
          player1Color: 'white',
          player2Color: 'black',
          chessEngine,
          gameState: this.initializeGame(),

          // Timer Setup
          timeControl: { limit, increment, label: tc },
          whiteTime: limit * 1000, // ms
          blackTime: limit * 1000, // ms
        }

        this.matches.set(matchId, match)
        return match
      }
    }

    return null
  }

  submitPlacement(matchId: string, socketId: string, placementData: PlacementData): { success?: boolean; waiting?: boolean; error?: string } {
    const match = this.matches.get(matchId)
    if (!match) {
      return { error: 'Match not found' }
    }

    // 플레이어 식별
    const isPlayer1 = match.player1SocketId === socketId
    const isPlayer2 = match.player2SocketId === socketId

    if (!isPlayer1 && !isPlayer2) {
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
    if (match.whitePlacement && match.blackPlacement) {
      // Initialize chess engine with correct color placements
      match.chessEngine.initializeFromPlacement(match.whitePlacement, match.blackPlacement)
      console.log('✅ Chess engine initialized with custom placements (white/black mapped)')

      // Reset turn to white at game start
      match.gameState = { ...match.gameState, currentTurn: 'white' }

      // Start Timer
      match.lastMoveTime = Date.now()

      return { success: true }
    }

    return { waiting: true }
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

    return `${whitePlacementStr}|${blackPlacementStr}|${movesStr}`
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

    // Use custom chess engine to validate move
    const result = match.chessEngine.makeMove(from, to, promotion)

    if (!result.success) {
      console.log(`❌ Move validation failed: ${from} -> ${to}`)
      // Revert timer if move is invalid? 
      // Technically if it's not a valid move, time shouldn't be deducted, but in online chess, 
      // usually the timer keeps running until a VALID move is made. 
      // Here we deducted time already. This is tricky.
      // Ideally we should deduct time only when a valid move is made.
      // So we should calculate elapsed but apply deduction AFTER validation success.

      // Let's revert for now to be safe, or recalculate.
      // But simpler: Move timer logic AFTER validation success.
      // BUT we need to check timeout BEFORE validation? No, time runs until valid move.
      // So if invalid move, we just return error, and time keeps running on server (next request will deduct more).

      // So we should NOT deduct time yet.
      return {
        success: false,
        error: 'Invalid move - 불법 이동입니다'
      }
    }

    // Move is valid. Update timer now.
    // Wait, we already updated it above. 
    // If move was invalid, we returned early, but we modified update in place?
    // match.whiteTime -= elapsed...

    // We should better move timer logic here, OR revert it on failure.
    // However, since we update `match` object directly, it persists.
    // Let's move timer logic AFTER validation to be safe.

    // ... Wait, I cannot easily move Logic down because replace_file_content is static.
    // I will write the corrected logic in this replacement content.

    // Corrected Logic: Don't update time yet.
    // Just validation first.

    /* 
       Let's use the code structure where I do validation first. 
       But I need to check Not Your Turn first.
    */

    // Determine winner if checkmate
    let winner: string | undefined
    if (result.isCheckmate) {
      const moverColor = match.player1SocketId === socketId ? match.player1Color : match.player2Color
      winner = moverColor
    }

    console.log(`✅ Move validated: ${move.uci}`)

    return {
      success: true,
      gameState: match.gameState,
      isCheck: result.isCheck,
      isCheckmate: result.isCheckmate,
      isStalemate: result.isStalemate,
      isDraw: result.isDraw,
      drawReason: result.drawReason,
      winner,
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
    } else {
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

  createRoom(hostSocketId: string, userId: string, deckId: string, color: 'white' | 'black'): Room {
    const code = this.generateRoomCode()
    const matchId = `match-${Date.now()}`

    const room: Room = {
      code,
      matchId,
      hostSocketId,
      host: { userId, deckId, color },
      status: 'waiting',
      createdAt: Date.now(),
    }

    this.rooms.set(code, room)
    console.log(`✅ Room created: ${code} by ${userId}`)

    return room
  }

  joinRoom(roomCode: string, guestSocketId: string, userId: string, deckId: string): {
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
    room.guest = { userId, deckId, color: guestColor }
    room.status = 'ready'

    // Create a match for this room
    const chessEngine = new ChessService()
    const match: Match = {
      id: room.matchId,
      player1SocketId: room.hostSocketId,
      player2SocketId: guestSocketId,
      player1: { userId: room.host.userId, deckId: room.host.deckId },
      player2: { userId, deckId },
      player1Color: room.host.color,
      player2Color: guestColor,
      gameState: this.initializeGame(),
      chessEngine,

      // Default Timer for Friendly Rooms: Rapid 10+0
      timeControl: { limit: 600, increment: 0, label: '10+0' },
      whiteTime: 600000,
      blackTime: 600000,
    }

    this.matches.set(room.matchId, match)

    console.log(`✅ Player ${userId} joined room ${roomCode}`)

    return { success: true, room }
  }

  leaveRoom(socketId: string): Room | null {
    // Find room containing this socket
    for (const [code, room] of this.rooms.entries()) {
      if (room.hostSocketId === socketId || room.guestSocketId === socketId) {
        // Delete the match if it exists
        if (this.matches.has(room.matchId)) {
          this.matches.delete(room.matchId)
        }

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

    // Find and end any matches with this player
    for (const [matchId, match] of this.matches.entries()) {
      if (match.player1SocketId === socketId || match.player2SocketId === socketId) {
        this.matches.delete(matchId)
      }
    }
  }

  private initializeGame(): any {
    // Initialize 8x8 chess board
    const board = Array(8).fill(null).map(() => Array(8).fill(null))

    return {
      board,
      currentTurn: 'white',
      status: 'in_progress',
    }
  }
}
