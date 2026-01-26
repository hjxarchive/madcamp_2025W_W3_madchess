import { Server, Socket } from 'socket.io'
import { GameManager } from '../engine/GameManager.js'

const gameManager = new GameManager()

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`)

    // ===== 방 시스템 이벤트 =====

    // 방 생성
    socket.on('create-room', (data: { userId: string; deckId: string; color: 'white' | 'black' }) => {
      console.log(`🏠 User ${data.userId} creating room...`)

      const room = gameManager.createRoom(socket.id, data.userId, data.deckId, data.color)

      // 방 생성 성공 응답
      socket.emit('room-created', {
        roomCode: room.code,
        room: room,
      })

      console.log(`✅ Room ${room.code} created and sent to ${socket.id}`)
    })

    // 방 참가
    socket.on('join-room', (data: { roomCode: string; userId: string; deckId: string }) => {
      console.log(`🚪 User ${data.userId} joining room ${data.roomCode}...`)

      const result = gameManager.joinRoom(data.roomCode, socket.id, data.userId, data.deckId)

      if (result.success && result.room) {
        // Socket을 matchId room에 join (실시간 동기화용)
        socket.join(result.room.matchId)
        console.log(`👥 Guest ${socket.id} joined room ${result.room.matchId}`)

        // Host도 matchId room에 join
        const hostSocket = io.sockets.sockets.get(result.room.hostSocketId)
        if (hostSocket) {
          hostSocket.join(result.room.matchId)
          console.log(`👥 Host ${result.room.hostSocketId} joined room ${result.room.matchId}`)
        }

        // 참가자에게 성공 응답
        socket.emit('room-joined', {
          room: result.room,
          matchId: result.room.matchId,
        })

        // 호스트에게 알림
        io.to(result.room.hostSocketId).emit('player-joined', {
          guest: result.room.guest,
          matchId: result.room.matchId,
        })

        console.log(`✅ User ${data.userId} joined room ${data.roomCode}`)
        console.log(`🎮 Both players in match room: ${result.room.matchId}`)
      } else {
        // 에러 응답
        socket.emit('room-error', {
          message: result.error || '알 수 없는 오류가 발생했습니다',
        })

        console.log(`❌ Failed to join room: ${result.error}`)
      }
    })

    // 방 퇴장
    socket.on('leave-room', () => {
      const room = gameManager.leaveRoom(socket.id)
      if (room) {
        // 상대방에게 알림 (있다면)
        const otherSocketId = room.hostSocketId === socket.id ? room.guestSocketId : room.hostSocketId
        if (otherSocketId) {
          io.to(otherSocketId).emit('player-left', {
            message: '상대방이 방을 나갔습니다',
          })
        }
      }
    })

    // ===== 기존 큐 시스템 이벤트 (유지) =====

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
      console.log(`🎲 Move from ${socket.id} in match ${data.matchId}:`, data.move)
      const result = gameManager.makeMove(data.matchId, socket.id, data.move)

      if (result.success) {
        // Broadcast move with check/checkmate status
        console.log(`📢 Broadcasting move to room ${data.matchId}`)
        io.to(data.matchId).emit('move-made', {
          move: data.move,
          gameState: result.gameState,
          socketId: socket.id,
          isCheck: result.isCheck,
          isCheckmate: result.isCheckmate,
        })

        // Handle checkmate
        if (result.isCheckmate) {
          console.log(`👑 Checkmate! Winner: ${result.winner}`)
          io.to(data.matchId).emit('game-over', {
            winner: result.winner,
            reason: 'checkmate',
          })
        }
        // Handle stalemate
        else if (result.isStalemate) {
          console.log(`🤝 Stalemate!`)
          io.to(data.matchId).emit('game-over', {
            winner: 'draw',
            reason: 'stalemate',
          })
        }
        // Handle draw
        else if (result.isDraw) {
          console.log(`🤝 Draw by ${result.drawReason}!`)
          io.to(data.matchId).emit('game-over', {
            winner: 'draw',
            reason: result.drawReason || 'draw',
          })
        }
      } else {
        socket.emit('move-error', { message: result.error })
      }
    })

    // Request legal moves for current position (server-authoritative)
    socket.on('request-legal-moves', (data: { matchId: string }) => {
      const result = gameManager.getLegalMoves(data.matchId, socket.id)
      if (result.success) {
        socket.emit('legal-moves', { legalMoves: result.legalMoves })
      } else {
        socket.emit('legal-moves-error', { message: result.error || 'Failed to fetch legal moves' })
      }
    })

    // Client declares game end (checkmate/stalemate backup - when server missed it)
    socket.on('declare-game-end', (data: { matchId: string; winner: string; reason: string }) => {
      console.log(`🏁 Client ${socket.id} declares game end:`, data)
      // Broadcast to all players in the match room
      io.to(data.matchId).emit('game-over', {
        winner: data.winner,
        reason: data.reason,
      })
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
