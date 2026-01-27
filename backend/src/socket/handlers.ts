import { Server, Socket } from 'socket.io'
import { GameManager } from '../engine/GameManager.js'
import * as gameService from '../modules/game/game.service.js'

const gameManager = new GameManager()

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`)

    // ===== 방 시스템 이벤트 =====

    // 방 생성
    socket.on('create-room', (data: { userId: string; deckId: string; color: 'white' | 'black'; username?: string; picture?: string; rating?: number }) => {
      const stringifiedUserId = String(data.userId)
      console.log(`🏠 User ${stringifiedUserId} creating room...`)

      const room = gameManager.createRoom(socket.id, stringifiedUserId, data.deckId, data.color, data.username, data.picture, data.rating)

      // 방 생성 성공 응답
      socket.emit('room-created', {
        roomCode: room.code,
        room: room,
      })

      console.log(`✅ Room ${room.code} created and sent to ${socket.id}`)
    })

    // 방 참가
    socket.on('join-room', (data: { roomCode: string; userId: string; deckId: string; username?: string; picture?: string; rating?: number }) => {
      const stringifiedUserId = String(data.userId)
      console.log(`🚪 User ${stringifiedUserId} joining room ${data.roomCode}...`)

      const result = gameManager.joinRoom(data.roomCode, socket.id, stringifiedUserId, data.deckId, data.username, data.picture, data.rating)

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
    socket.on('join-queue', (data: { userId: string; deckId: string; timeControl?: string; username?: string; picture?: string; rating?: number }) => {
      const stringifiedUserId = String(data.userId)
      console.log(`User ${stringifiedUserId} (${data.username}) joined queue (${data.timeControl})`)
      gameManager.addToQueue(socket.id, stringifiedUserId, data.deckId, data.timeControl, data.username, data.picture, data.rating)

      // Try to match players
      const match = gameManager.tryMatchPlayers()
      if (match) {
        io.to(match.player1SocketId).emit('game-found', {
          matchId: match.id,
          opponent: match.player2,
          yourColor: match.player1Color
        })
        io.to(match.player2SocketId).emit('game-found', {
          matchId: match.id,
          opponent: match.player1,
          yourColor: match.player2Color
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

    // Player makes a move
    socket.on('make-move', (data: { matchId: string; move: any }) => {
      // console.log(`♟️ Move received in match ${data.matchId}:`, data.move)

      const result = gameManager.makeMove(data.matchId, socket.id, data.move)

      if (result.success) {
        // Broadcast move to everyone in the room (including spectators)
        io.to(data.matchId).emit('move-made', {
          matchId: data.matchId,
          move: data.move,
          socketId: socket.id, // Who made the move
          moverColor: result.moverColor, // 'white' or 'black'
          gameState: result.gameState, // Updated board state
          isCheck: result.isCheck,
          isCheckmate: result.isCheckmate,
          isStalemate: result.isStalemate,
          isDraw: result.isDraw,
          whiteTime: result.whiteTime,
          blackTime: result.blackTime
        })

        // Handle Game Over
        if (result.isCheckmate || result.isStalemate || result.isDraw || result.winner) {
          const winner = result.winner || (result.isCheckmate
            ? (result.moverColor === 'white' ? 'white' : 'black')
            : 'draw')

          const reason = result.drawReason || (result.isCheckmate ? 'checkmate' : (result.isStalemate ? 'stalemate' : 'draw'))

          console.log(`👑 Game Over! Winner: ${winner}, Reason: ${reason}`)

          // Update game status in GameManager
          gameManager.endGame(data.matchId, { winner, reason })

          io.to(data.matchId).emit('game-over', {
            winner,
            reason,
          })

          // Save game result to DB
          const match = gameManager.getMatch(data.matchId)
          if (match) {
            const whiteUserId = match.player1Color === 'white' ? match.player1.userId : match.player2.userId
            const blackUserId = match.player1Color === 'black' ? match.player1.userId : match.player2.userId
            const whiteDeckId = match.player1Color === 'white' ? match.player1.deckId : match.player2.deckId
            const blackDeckId = match.player1Color === 'black' ? match.player1.deckId : match.player2.deckId
            const pgn = gameManager.getMatchPGN(data.matchId)

            gameService.saveGameResult(whiteUserId, blackUserId, whiteDeckId, blackDeckId, winner as 'white' | 'black' | 'draw', reason, pgn)
          }
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

    // Request castling options
    socket.on('request-castling-options', (data: { matchId: string; color: 'white' | 'black' }) => {
      console.log(`♜ Castling options requested for ${data.color} in ${data.matchId}`)
      const result = gameManager.getCastlingOptions(data.matchId, data.color)
      if (result.success) {
        socket.emit('castling-options', { options: result.options })
        console.log(`✅ Sent castling options:`, result.options)
      } else {
        socket.emit('castling-options-error', { message: result.error || 'Failed to fetch castling options' })
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

      // DB에 게임 결과 저장 (백업 선언도 저장)
      const match = gameManager.getMatch(data.matchId)
      if (match) {
        const whiteUserId = match.player1Color === 'white' ? match.player1.userId : match.player2.userId
        const blackUserId = match.player1Color === 'black' ? match.player1.userId : match.player2.userId
        const whiteDeckId = match.player1Color === 'white' ? match.player1.deckId : match.player2.deckId
        const blackDeckId = match.player1Color === 'black' ? match.player1.deckId : match.player2.deckId
        const winner = data.winner as 'white' | 'black' | 'draw'
        const pgn = gameManager.getMatchPGN(data.matchId)
        gameService.saveGameResult(whiteUserId, blackUserId, whiteDeckId, blackDeckId, winner, data.reason, pgn)
      }
    })



    // Rejoin game
    socket.on('rejoin-game', (data: { matchId: string; userId: string }) => {
      const stringifiedUserId = String(data.userId)
      console.log(`🔄 User ${stringifiedUserId} rejoining match ${data.matchId}`)
      const result = gameManager.reconnectPlayer(data.matchId, stringifiedUserId, socket.id)

      if (result.success && result.match) {
        socket.join(data.matchId)

        const whitePlayer = result.match.player1Color === 'white' ? result.match.player1 : result.match.player2
        const blackPlayer = result.match.player1Color === 'black' ? result.match.player1 : result.match.player2

        socket.emit('game-rejoined', {
          matchId: data.matchId,
          gameState: result.match.gameState,
          whiteTime: result.match.whiteTime,
          blackTime: result.match.blackTime,
          yourColor: result.playerColor,
          white: whitePlayer,
          black: blackPlayer,
          pgn: gameManager.getMatchPGN(data.matchId)
        })
        console.log(`✅ User ${data.userId} rejoined match ${data.matchId}`)
      } else {
        socket.emit('rejoin-error', { message: result.error || 'Failed to rejoin' })
      }
    })

    // Resign - 기권
    socket.on('resign', (data: { matchId: string }) => {
      console.log(`🏳️ Player ${socket.id} resigned in match ${data.matchId}`)
      console.log(`📦 Received data:`, JSON.stringify(data))

      const match = gameManager.getMatch(data.matchId)
      if (match) {
        // Determine winner (opponent of resigned player)
        // 기권한 플레이어의 색상을 확인한 후 반대 색상이 승자
        const resignedPlayerColor = match.player1SocketId === socket.id
          ? match.player1Color
          : match.player2Color
        const winner = resignedPlayerColor === 'white' ? 'black' : 'white'

        console.log(`🏆 Resigned player: ${socket.id} (${resignedPlayerColor}), Winner: ${winner}`)

        gameManager.endGame(data.matchId, { winner, reason: 'resignation' }) // Status Update

        io.to(data.matchId).emit('game-over', {
          winner,
          reason: 'resignation',
        })

        // DB에 게임 결과 저장
        const whiteUserId = match.player1Color === 'white' ? match.player1.userId : match.player2.userId
        const blackUserId = match.player1Color === 'black' ? match.player1.userId : match.player2.userId
        const whiteDeckId = match.player1Color === 'white' ? match.player1.deckId : match.player2.deckId
        const blackDeckId = match.player1Color === 'black' ? match.player1.deckId : match.player2.deckId
        const pgn = gameManager.getMatchPGN(data.matchId)
        gameService.saveGameResult(whiteUserId, blackUserId, whiteDeckId, blackDeckId, winner as 'white' | 'black', 'resignation', pgn)
      } else {
        console.log(`❌ Match not found: ${data.matchId}`)
      }
    })

    // Timeout - 시간 초과 패배
    socket.on('timeout', (data: { matchId: string; loserColor?: 'white' | 'black' }) => {
      console.log(`⏰ Timeout reported by ${socket.id} in match ${data.matchId}`)

      const match = gameManager.getMatch(data.matchId)
      if (match) {
        // loserColor가 지정되면 그 색상이 패배, 아니면 보낸 플레이어가 패배
        let timedOutColor: 'white' | 'black'
        if (data.loserColor) {
          timedOutColor = data.loserColor
        } else {
          timedOutColor = match.player1SocketId === socket.id
            ? match.player1Color
            : match.player2Color
        }

        // 서버 시간 검증: 해당 색상의 남은 시간이 실제로 0 이하인지 확인
        const remainingTime = timedOutColor === 'white' ? match.whiteTime : match.blackTime
        if (match.lastMoveTime) {
          const elapsed = Date.now() - match.lastMoveTime
          const currentTurnColor = match.gameState.currentTurn
          // 현재 턴인 플레이어의 시간만 차감됨
          if (currentTurnColor === timedOutColor) {
            const actualRemaining = remainingTime - elapsed
            if (actualRemaining > 1000) {
              // 1초 이상 남아있으면 타임아웃 거부 (네트워크 지연 감안)
              console.log(`❌ Timeout rejected: ${timedOutColor} has ${actualRemaining}ms remaining`)
              return
            }
          }
        }

        const winner = timedOutColor === 'white' ? 'black' : 'white'
        console.log(`🏆 Timeout: ${timedOutColor} lost, ${winner} wins`)

        gameManager.endGame(data.matchId, { winner, reason: 'timeout' }) // Status Update

        io.to(data.matchId).emit('game-over', {
          winner,
          reason: 'timeout',
        })

        // DB에 게임 결과 저장
        const whiteUserId = match.player1Color === 'white' ? match.player1.userId : match.player2.userId
        const blackUserId = match.player1Color === 'black' ? match.player1.userId : match.player2.userId
        const whiteDeckId = match.player1Color === 'white' ? match.player1.deckId : match.player2.deckId
        const blackDeckId = match.player1Color === 'black' ? match.player1.deckId : match.player2.deckId
        const pgn = gameManager.getMatchPGN(data.matchId)
        gameService.saveGameResult(whiteUserId, blackUserId, whiteDeckId, blackDeckId, winner as 'white' | 'black', 'timeout', pgn)
      }
    })

    // Draw offer - 무승부 제안
    socket.on('offer-draw', (data: { matchId: string }) => {
      console.log(`🤝 Player ${socket.id} offers draw in match ${data.matchId}`)
      const match = gameManager.getMatch(data.matchId)
      if (match) {
        // Send draw offer to opponent
        const opponentSocketId = match.player1SocketId === socket.id
          ? match.player2SocketId
          : match.player1SocketId
        io.to(opponentSocketId).emit('draw-offered', {
          from: socket.id,
        })
      }
    })

    // Draw response - 무승부 응답
    socket.on('respond-draw', (data: { matchId: string; accept: boolean }) => {
      console.log(`🤝 Player ${socket.id} ${data.accept ? 'accepted' : 'rejected'} draw in match ${data.matchId}`)
      if (data.accept) {
        // Draw accepted - game over
        gameManager.endGame(data.matchId, { winner: 'draw', reason: 'mutual agreement' }) // Status Update

        io.to(data.matchId).emit('game-over', {
          winner: 'draw',
          reason: 'mutual agreement',
        })

        // DB에 게임 결과 저장
        const match = gameManager.getMatch(data.matchId)
        if (match) {
          const whiteUserId = match.player1Color === 'white' ? match.player1.userId : match.player2.userId
          const blackUserId = match.player1Color === 'black' ? match.player1.userId : match.player2.userId
          const whiteDeckId = match.player1Color === 'white' ? match.player1.deckId : match.player2.deckId
          const blackDeckId = match.player1Color === 'black' ? match.player1.deckId : match.player2.deckId
          const pgn = gameManager.getMatchPGN(data.matchId)
          gameService.saveGameResult(whiteUserId, blackUserId, whiteDeckId, blackDeckId, 'draw', 'mutual agreement', pgn)
        }
      }
      // If rejected, no action needed - game continues
    })

    // Leave queue
    socket.on('leave-queue', () => {
      gameManager.removeFromQueue(socket.id)
    })

    // ===== Spectator Events =====

    // Get list of live games
    socket.on('get-live-games', () => {
      const liveGames = gameManager.getLiveGames()
      socket.emit('live-games', { games: liveGames })
      console.log(`📺 Sent ${liveGames.length} live games to ${socket.id}`)
    })

    // Join a game as spectator
    socket.on('spectate-game', (data: { matchId: string }) => {
      console.log(`👁️ ${socket.id} requesting to spectate ${data.matchId}`)
      const state = gameManager.getGameStateForSpectator(data.matchId)

      if (state) {
        socket.join(data.matchId) // Join the room to receive move-made, game-over events
        gameManager.addSpectator(data.matchId, socket.id)
        socket.emit('spectate-joined', state)
        console.log(`✅ ${socket.id} is now spectating ${data.matchId}`)
      } else {
        socket.emit('spectate-error', { message: 'Game not found or not in progress' })
        console.log(`❌ Spectate failed for ${data.matchId}`)
      }
    })

    // Leave spectating
    socket.on('leave-spectate', (data: { matchId: string }) => {
      socket.leave(data.matchId)
      gameManager.removeSpectator(data.matchId, socket.id)
      console.log(`👁️ ${socket.id} left spectating ${data.matchId}`)
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
      gameManager.handleDisconnect(socket.id)
      gameManager.removeSpectatorFromAll(socket.id) // Clean up spectator from all matches
    })
  })
}