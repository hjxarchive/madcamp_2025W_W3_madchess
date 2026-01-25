import { ChessService } from './ChessService'

interface QueuePlayer {
  socketId: string
  userId: string
  deckId: string
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
  player1Placement?: Array<{ type: string; file: string; rank: number }>
  player2Placement?: Array<{ type: string; file: string; rank: number }>
  gameState: any
  chessEngine: ChessService
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

  addToQueue(socketId: string, userId: string, deckId: string) {
    this.queue.push({ socketId, userId, deckId })
  }

  removeFromQueue(socketId: string) {
    this.queue = this.queue.filter(player => player.socketId !== socketId)
  }

  tryMatchPlayers(): Match | null {
    if (this.queue.length < 2) {
      return null
    }

    const player1 = this.queue.shift()!
    const player2 = this.queue.shift()!

    const matchId = `match-${Date.now()}`
    const chessEngine = new ChessService()
    const match: Match = {
      id: matchId,
      player1SocketId: player1.socketId,
      player2SocketId: player2.socketId,
      player1: { userId: player1.userId, deckId: player1.deckId },
      player2: { userId: player2.userId, deckId: player2.deckId },
      chessEngine,
      gameState: this.initializeGame(),
    }

    this.matches.set(matchId, match)
    return match
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

    // 배치 정보 저장
    if (isPlayer1) {
      match.player1Placement = placementData.placement
    } else {
      match.player2Placement = placementData.placement
    }

    // 양쪽 모두 배치 완료 확인
    if (match.player1Placement && match.player2Placement) {
      // Initialize chess engine with both placements
      match.chessEngine.initializeFromPlacement(match.player1Placement, match.player2Placement)
      console.log('✅ Chess engine initialized with custom placements')

      return { success: true }
    } else {
      return { waiting: true }
    }
  }

  getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId)
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

    const from = move.uci.substring(0, 2)
    const to = move.uci.substring(2, 4)
    const promotion = move.uci.length === 5 ? move.uci[4] : undefined

    console.log(`🔍 Validating move: ${from} -> ${to}${promotion ? ` (promotion: ${promotion})` : ''}`)

    // Use custom chess engine to validate move
    const result = match.chessEngine.makeMove(from, to, promotion)

    if (!result.success) {
      console.log(`❌ Move validation failed: ${from} -> ${to}`)
      return {
        success: false,
        error: 'Invalid move - 불법 이동입니다'
      }
    }

    // Determine winner if checkmate
    let winner: string | undefined
    if (result.isCheckmate) {
      // The player who just moved wins
      winner = match.player1SocketId === socketId ? 'white' : 'black'
    }

    console.log(`✅ Move validated: ${move.uci}, Check: ${result.isCheck}, Checkmate: ${result.isCheckmate}, Stalemate: ${result.isStalemate}, Draw: ${result.isDraw}${result.drawReason ? ` (${result.drawReason})` : ''}`)

    return {
      success: true,
      gameState: match.gameState,
      isCheck: result.isCheck,
      isCheckmate: result.isCheckmate,
      isStalemate: result.isStalemate,
      isDraw: result.isDraw,
      drawReason: result.drawReason,
      winner,
    }
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
      gameState: this.initializeGame(),
      chessEngine,
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
      currentTurn: 'player1',
      status: 'in_progress',
    }
  }
}
