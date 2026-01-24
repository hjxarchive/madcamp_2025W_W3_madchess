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

    // Submit placement
    socket.on('submit-placement', (data: { matchId: string; placement: any }) => {
      console.log('Received placement from', socket.id, data)
      const result = gameManager.submitPlacement(data.matchId, socket.id, data.placement)
      
      if (result.waiting) {
        // 한 명만 배치 완료, 상대 대기 중
        socket.emit('placement:waiting')
      } else if (result.success) {
        // 양쪽 모두 배치 완료, 게임 시작
        const match = gameManager.getMatch(data.matchId)
        if (match) {
          // 각 플레이어에게 상대방의 배치 정보 전송
          io.to(match.player1SocketId).emit('placement:complete', {
            opponentPlacement: match.player2Placement,
          })
          io.to(match.player2SocketId).emit('placement:complete', {
            opponentPlacement: match.player1Placement,
          })
        }
      } else {
        socket.emit('placement-error', { message: result.error })
      }
    })

    // Make a move
    socket.on('make-move', (data: { matchId: string; move: any }) => {
      const result = gameManager.makeMove(data.matchId, socket.id, data.move)
      if (result.success) {
        // 이동을 보낸 socketId를 포함하여 브로드캐스트
        io.to(data.matchId).emit('move-made', {
          move: data.move,
          gameState: result.gameState,
          socketId: socket.id,  // 누가 이동했는지 식별
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
