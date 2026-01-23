import { Server, Socket } from 'socket.io'
import { GameManager } from '../engine/GameManager.js'

const gameManager = new GameManager()

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`)

    // Join game queue
    socket.on('join-queue', (data: { userId: string; deckId: string }) => {
      console.log(`User ${data.userId} joined queue`)
      gameManager.addToQueue(socket.id, data.userId, data.deckId)
      
      // Try to match players
      const match = gameManager.tryMatchPlayers()
      if (match) {
        io.to(match.player1SocketId).emit('game-found', {
          matchId: match.id,
          opponent: match.player2,
        })
        io.to(match.player2SocketId).emit('game-found', {
          matchId: match.id,
          opponent: match.player1,
        })
      }
    })

    // Make a move
    socket.on('make-move', (data: { matchId: string; move: any }) => {
      const result = gameManager.makeMove(data.matchId, socket.id, data.move)
      if (result.success) {
        io.to(data.matchId).emit('move-made', {
          move: data.move,
          gameState: result.gameState,
        })
      } else {
        socket.emit('move-error', { message: result.error })
      }
    })

    // Leave queue
    socket.on('leave-queue', () => {
      gameManager.removeFromQueue(socket.id)
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
      gameManager.handleDisconnect(socket.id)
    })
  })
}
