import { io, Socket } from 'socket.io-client'

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
}

export const socketService = new SocketService()
