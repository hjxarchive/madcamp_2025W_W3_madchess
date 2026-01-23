interface QueuePlayer {
  socketId: string
  userId: string
  deckId: string
}

interface Match {
  id: string
  player1SocketId: string
  player2SocketId: string
  player1: { userId: string; deckId: string }
  player2: { userId: string; deckId: string }
  gameState: any
}

export class GameManager {
  private queue: QueuePlayer[] = []
  private matches: Map<string, Match> = new Map()

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
    const match: Match = {
      id: matchId,
      player1SocketId: player1.socketId,
      player2SocketId: player2.socketId,
      player1: { userId: player1.userId, deckId: player1.deckId },
      player2: { userId: player2.userId, deckId: player2.deckId },
      gameState: this.initializeGame(),
    }

    this.matches.set(matchId, match)
    return match
  }

  makeMove(matchId: string, socketId: string, move: any): { success: boolean; gameState?: any; error?: string } {
    const match = this.matches.get(matchId)
    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    // Validate move and update game state
    // This is a placeholder - implement actual game logic
    return { success: true, gameState: match.gameState }
  }

  handleDisconnect(socketId: string) {
    this.removeFromQueue(socketId)
    
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
