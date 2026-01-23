import { io, Socket } from 'socket.io-client'
import { Move } from '../types/game'

class SocketService {
  private socket: Socket | null = null

  connect() {
    this.socket = io('http://localhost:5000', {
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
  joinQueue(userId: string, deckId: string) {
    if (this.socket) {
      this.socket.emit('join-queue', { userId, deckId })
      console.log('Joined queue:', { userId, deckId })
    }
  }

  // 게임 큐에서 나가기
  leaveQueue() {
    if (this.socket) {
      this.socket.emit('leave-queue')
      console.log('Left queue')
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

  // 기물 배치 전송
  sendPlacement(roomId: string, placement: any) {
    if (this.socket) {
      this.socket.emit('submit-placement', { matchId: roomId, placement })
      console.log('Placement sent:', { matchId: roomId, placement })
    }
  }
}

export const socketService = new SocketService()
