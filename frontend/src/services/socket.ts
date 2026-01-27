import { io, Socket } from 'socket.io-client'
import { Move } from '../types/game'

class SocketService {
  private socket: Socket | null = null

  connect() {
    const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5001'
    this.socket = io(socketUrl, {
      transports: ['websocket'],
    })

    this.socket.on('connect', () => {
      console.log('Connected to server')
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server')
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket() {
    return this.socket
  }

  // 게임 큐에 참가
  joinQueue(userId: string, deckId: string, timeControl?: string, username?: string, picture?: string, rating?: number) {
    if (this.socket) {
      this.socket.emit('join-queue', { userId, deckId, timeControl, username, picture, rating })
      console.log('Joined queue:', { userId, deckId, timeControl, username })
    }
  }

  // 게임 큐에서 나가기
  leaveQueue() {
    if (this.socket) {
      this.socket.emit('leave-queue')
      console.log('Left queue')
    }
  }

  // 방 생성
  createRoom(userId: string, deckId: string, color: 'white' | 'black', username?: string, picture?: string, rating?: number) {
    if (this.socket) {
      this.socket.emit('create-room', { userId, deckId, color, username, picture, rating })
      console.log('Creating room:', { userId, deckId, color, username })
    }
  }

  // 방 참가
  joinRoom(roomCode: string, userId: string, deckId: string, username?: string, picture?: string, rating?: number) {
    if (this.socket) {
      this.socket.emit('join-room', { roomCode, userId, deckId, username, picture, rating })
      console.log('Joining room:', { roomCode, userId, deckId, username })
    }
  }

  // 방 퇴장
  leaveRoom() {
    if (this.socket) {
      this.socket.emit('leave-room')
      console.log('Leaving room')
    }
  }

  // 수 전송
  sendMove(roomId: string, move: Move) {
    if (this.socket) {
      this.socket.emit('make-move', { matchId: roomId, move })
      console.log('Move sent:', { matchId: roomId, move })
    } else {
      console.error('Socket not connected')
    }
  }

  // 합법수 요청
  requestLegalMoves(roomId: string) {
    if (this.socket) {
      this.socket.emit('request-legal-moves', { matchId: roomId })
      console.log('Requested legal moves:', { matchId: roomId })
    }
  }

  // 기물 배치 전송
  sendPlacement(roomId: string, placement: any) {
    if (this.socket) {
      this.socket.emit('submit-placement', { matchId: roomId, placement })
      console.log('Placement sent:', { matchId: roomId, placement })
    }
  }

  // 클라이언트에서 체크메이트/스테일메이트를 감지했을 때 서버에 알림
  declareGameEnd(roomId: string, winner: string, reason: string) {
    if (this.socket) {
      this.socket.emit('declare-game-end', { matchId: roomId, winner, reason })
      console.log('Game end declared:', { matchId: roomId, winner, reason })
    }
  }

  // Request castling options from server
  requestCastlingOptions(matchId: string, color: 'white' | 'black') {
    if (this.socket) {
      this.socket.emit('request-castling-options', { matchId, color })
      console.log(`♜ Requesting castling options for ${color}`)
    }
  }

  // 기권
  resign(matchId: string) {
    if (this.socket) {
      this.socket.emit('resign', { matchId })
      console.log('🏳️ Player resigned:', { matchId })
    }
  }

  // 무승부 제안
  offerDraw(matchId: string) {
    if (this.socket) {
      this.socket.emit('offer-draw', { matchId })
      console.log('🤝 Draw offered:', { matchId })
    }
  }

  // 시간 초과 알림
  reportTimeout(matchId: string, loserColor?: 'white' | 'black') {
    if (this.socket) {
      this.socket.emit('timeout', { matchId, loserColor })
      console.log('Timeout reported:', { matchId, loserColor })
    }
  }

  // 무승부 제안 응답
  respondToDraw(matchId: string, accept: boolean) {
    if (this.socket) {
      this.socket.emit('respond-draw', { matchId, accept })
      console.log(`🤝 Draw ${accept ? 'accepted' : 'rejected'}:`, { matchId })
    }
  }

  // Event listeners

  // 게임 매칭 완료
  onGameFound(callback: (data: { matchId: string; opponent: any; yourColor?: 'white' | 'black' }) => void) {
    if (this.socket) {
      this.socket.on('game-found', callback)
    }
  }

  // 방 생성 완료
  onRoomCreated(callback: (data: { roomCode: string; room: any }) => void) {
    if (this.socket) {
      this.socket.on('room-created', callback)
    }
  }

  // 방 참가 완료
  onRoomJoined(callback: (data: { room: any; matchId: string }) => void) {
    if (this.socket) {
      this.socket.on('room-joined', callback)
    }
  }

  // 플레이어 참가 (호스트가 받음)
  onPlayerJoined(callback: (data: { guest: any; matchId: string }) => void) {
    if (this.socket) {
      this.socket.on('player-joined', callback)
    }
  }

  // 방 에러
  onRoomError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('room-error', callback)
    }
  }

  // 플레이어 퇴장
  onPlayerLeft(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('player-left', callback)
    }
  }

  // 배치 대기 중 (한 플레이어만 배치 완료)
  onPlacementWaiting(callback: () => void) {
    if (this.socket) {
      this.socket.on('placement:waiting', callback)
    }
  }

  // 양쪽 배치 완료, 게임 시작
  onPlacementComplete(callback: (data: { opponentPlacement: any }) => void) {
    if (this.socket) {
      this.socket.on('placement:complete', callback)
    }
  }

  // 배치 에러
  onPlacementError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('placement-error', callback)
    }
  }

  // 이동 완료
  onMoveMade(callback: (data: {
    move: Move
    gameState: any
    socketId: string
    isCheck?: boolean
    isCheckmate?: boolean
  }) => void) {
    if (this.socket) {
      this.socket.on('move-made', callback)
    }
  }

  // 게임 종료
  onGameOver(callback: (data: { winner: string; reason: string }) => void) {
    if (this.socket) {
      this.socket.on('game-over', callback)
    }
  }

  // 이동 에러
  onMoveError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('move-error', callback)
    }
  }

  // 합법수 응답
  onLegalMoves(callback: (data: { legalMoves: Array<{ from: string; to: string; promotion?: string }>; gameState?: { isCheck: boolean; isCheckmate: boolean; isStalemate: boolean } }) => void) {
    if (this.socket) {
      this.socket.on('legal-moves', callback)
    }
  }

  onLegalMovesError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('legal-moves-error', callback)
    }
  }

  // Castling options response
  onCastlingOptions(callback: (data: { options: Array<{ rookPos: string; kingPos: string; kingTarget: string; rookTarget: string; side: 'kingside' | 'queenside' }> }) => void) {
    if (this.socket) {
      this.socket.on('castling-options', callback)
    }
  }

  onCastlingOptionsError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('castling-options-error', callback)
    }
  }

  // 무승부 제안 받음
  onDrawOffered(callback: (data: { from: string }) => void) {
    if (this.socket) {
      this.socket.on('draw-offered', callback)
    }
  }

  // 게임 재참가
  rejoinGame(matchId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('rejoin-game', { matchId, userId })
    }
  }

  onGameRejoined(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('game-rejoined', callback)
    }
  }

  onRejoinError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('rejoin-error', callback)
    }
  }

  offGameRejoined() {
    if (this.socket) {
      this.socket.off('game-rejoined')
    }
  }

  offRejoinError() {
    if (this.socket) {
      this.socket.off('rejoin-error')
    }
  }

  offDrawOffered() {
    if (this.socket) {
      this.socket.off('draw-offered')
    }
  }

  // Remove event listeners
  offGameFound() {
    if (this.socket) {
      this.socket.off('game-found')
    }
  }

  offRoomCreated() {
    if (this.socket) {
      this.socket.off('room-created')
    }
  }

  offRoomJoined() {
    if (this.socket) {
      this.socket.off('room-joined')
    }
  }

  offPlayerJoined() {
    if (this.socket) {
      this.socket.off('player-joined')
    }
  }

  offRoomError() {
    if (this.socket) {
      this.socket.off('room-error')
    }
  }

  offPlayerLeft() {
    if (this.socket) {
      this.socket.off('player-left')
    }
  }

  offPlacementWaiting() {
    if (this.socket) {
      this.socket.off('placement:waiting')
    }
  }

  offPlacementComplete() {
    if (this.socket) {
      this.socket.off('placement:complete')
    }
  }

  offPlacementError() {
    if (this.socket) {
      this.socket.off('placement-error')
    }
  }

  offMoveMade() {
    if (this.socket) {
      this.socket.off('move-made')
    }
  }

  offGameOver() {
    if (this.socket) {
      this.socket.off('game-over')
    }
  }

  offMoveError() {
    if (this.socket) {
      this.socket.off('move-error')
    }
  }

  offLegalMoves() {
    if (this.socket) {
      this.socket.off('legal-moves')
    }
  }

  offLegalMovesError() {
    if (this.socket) {
      this.socket.off('legal-moves-error')
    }
  }

  // ===== Spectator Methods =====

  // Request list of live games
  requestLiveGames() {
    if (this.socket) {
      this.socket.emit('get-live-games')
      console.log('📺 Requesting live games...')
    }
  }

  // Join a game as spectator
  spectateGame(matchId: string) {
    if (this.socket) {
      this.socket.emit('spectate-game', { matchId })
      console.log(`👁️ Requesting to spectate ${matchId}`)
    }
  }

  // Leave spectating
  leaveSpectate(matchId: string) {
    if (this.socket) {
      this.socket.emit('leave-spectate', { matchId })
      console.log(`👁️ Leaving spectate ${matchId}`)
    }
  }

  // Listener for live games list
  onLiveGames(callback: (data: {
    games: Array<{
      matchId: string;
      white: { username: string; rating: number };
      black: { username: string; rating: number };
      timeControl: string;
      spectatorCount: number;
      currentTurn: 'white' | 'black';
      board: any;
    }>
  }) => void) {
    if (this.socket) {
      this.socket.on('live-games', callback)
    }
  }

  // Listener for joining spectate
  onSpectateJoined(callback: (data: {
    gameState: any;
    whiteTime: number;
    blackTime: number;
    white: { username: string; rating: number };
    black: { username: string; rating: number };
    timeControl: string;
    pgn: string;
  }) => void) {
    if (this.socket) {
      this.socket.on('spectate-joined', callback)
    }
  }

  // Listener for spectate error
  onSpectateError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('spectate-error', callback)
    }
  }

  // Off methods for spectator
  offLiveGames() {
    if (this.socket) {
      this.socket.off('live-games')
    }
  }

  offSpectateJoined() {
    if (this.socket) {
      this.socket.off('spectate-joined')
    }
  }

  offSpectateError() {
    if (this.socket) {
      this.socket.off('spectate-error')
    }
  }

  // Analysis
  requestAnalysis(matchId: string) {
    if (this.socket) {
      this.socket.emit('request-analysis', { matchId })
      console.log('🧠 Requesting analysis for match', matchId)
    }
  }

  onAnalysisResult(callback: (data: { type: 'cp' | 'mate', value: number, bestMove?: string }) => void) {
    if (this.socket) {
      this.socket.on('analysis-result', callback)
    }
  }

  onAnalysisError(callback: (data: { message: string }) => void) {
    if (this.socket) {
      this.socket.on('analysis-error', callback)
    }
  }

  offAnalysisResult() {
    if (this.socket) {
      this.socket.off('analysis-result')
    }
  }

  offAnalysisError() {
    if (this.socket) {
      this.socket.off('analysis-error')
    }
  }
}

export const socketService = new SocketService()
