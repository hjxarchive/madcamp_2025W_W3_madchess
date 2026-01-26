import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { socketService } from '../services/socket'

const KING_IMAGES = {
  white: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  black: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
}

type Mode = 'select' | 'create' | 'join'

export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('select')
  const [selectedColor, setSelectedColor] = useState<'white' | 'black' | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [inputRoomCode, setInputRoomCode] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')

  // WebSocket 연결
  useEffect(() => {
    socketService.connect()

    // 방 생성 성공
    socketService.onRoomCreated((data) => {
      console.log('Room created:', data)
      setRoomCode(data.roomCode)
      setWaiting(true)
      setError('')
    })

    // 호스트: 플레이어 참가 알림
    socketService.onPlayerJoined((data) => {
      console.log('Player joined:', data)
      // 상대가 참가했으면 배치 페이지로 이동
      sessionStorage.setItem('selectedColor', selectedColor!)
      sessionStorage.setItem('matchId', data.matchId)
      navigate(`/placement/${data.matchId}`)
    })

    // 게스트: 방 참가 성공
    socketService.onRoomJoined((data) => {
      console.log('Joined room:', data)
      // 참가 성공하면 배치 페이지로 이동
      const myColor = data.room.guest.color
      sessionStorage.setItem('selectedColor', myColor)
      sessionStorage.setItem('matchId', data.matchId)
      navigate(`/placement/${data.matchId}`)
    })

    // 방 에러
    socketService.onRoomError((data) => {
      console.error('Room error:', data.message)
      setError(data.message)
      setWaiting(false)
    })

    // 플레이어 퇴장
    socketService.onPlayerLeft((data) => {
      alert(data.message)
      setWaiting(false)
      setMode('select')
    })

    return () => {
      socketService.offRoomCreated()
      socketService.offPlayerJoined()
      socketService.offRoomJoined()
      socketService.offRoomError()
      socketService.offPlayerLeft()
    }
  }, [navigate, selectedColor])

  const handleCreateRoom = () => {
    if (!selectedColor) return

    const userId = `user-${Date.now()}`
    const deckId = 'default-deck'

    socketService.createRoom(userId, deckId, selectedColor)
  }

  const handleJoinRoom = () => {
    if (!inputRoomCode.trim()) {
      setError('방 코드를 입력해주세요')
      return
    }

    const userId = `user-${Date.now()}`
    const deckId = 'default-deck'

    socketService.joinRoom(inputRoomCode.trim().toUpperCase(), userId, deckId)
  }

  const handleCopyRoomCode = () => {
    if (roomCode) {
      try {
        navigator.clipboard.writeText(roomCode)
        alert('방 코드가 복사되었습니다!')
      } catch (error) {
        // HTTP에서는 clipboard API 사용 불가
        alert(`방 코드: ${roomCode}\n(수동으로 복사해주세요)`)
      }
    }
  }
  const handleCancel = () => {
    if (waiting) {
      socketService.leaveRoom()
    }
    setMode('select')
    setSelectedColor(null)
    setRoomCode('')
    setInputRoomCode('')
    setWaiting(false)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-slate-200 font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <span className="text-lg">←</span>
            <span className="font-medium">Back to Home</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 grid place-items-center rounded-sm bg-yellow-500 text-gray-900 font-black">♟</div>
            <span className="font-semibold text-white">Mad Chess</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center text-white">Matchmaking</h1>

          {/* 모드 선택 */}
          {mode === 'select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button
                onClick={() => setMode('create')}
                className="group relative overflow-hidden rounded-xl border border-gray-700 bg-slate-800/50 p-8 text-left transition-all hover:bg-slate-800 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10"
              >
                <div className="text-4xl mb-4 bg-slate-900/50 w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">🏠</div>
                <h3 className="text-xl font-bold text-white mb-2">Create Room</h3>
                <p className="text-sm text-slate-400">Host a game and invite a friend using a code.</p>
              </button>

              <button
                onClick={() => setMode('join')}
                className="group relative overflow-hidden rounded-xl border border-gray-700 bg-slate-800/50 p-8 text-left transition-all hover:bg-slate-800 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="text-4xl mb-4 bg-slate-900/50 w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">🚪</div>
                <h3 className="text-xl font-bold text-white mb-2">Join Room</h3>
                <p className="text-sm text-slate-400">Enter a room code to join an existing game.</p>
              </button>
            </div>
          )}

          {/* 방 만들기 */}
          {mode === 'create' && !waiting && (
            <div className="bg-slate-800/50 border border-gray-700 rounded-xl p-8">
              <h2 className="text-xl font-semibold mb-6 text-center">Select Your Side</h2>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <button
                  onClick={() => setSelectedColor('white')}
                  className={`
                    p-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-4
                    ${selectedColor === 'white'
                      ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/10'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
                    }
                  `}
                >
                  <img src={KING_IMAGES.white} alt="White King" className="w-16 h-16 drop-shadow-md" />
                  <div className="text-center">
                    <div className="font-bold text-white">White</div>
                    <div className="text-xs text-slate-400 mt-1">First Move</div>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedColor('black')}
                  className={`
                    p-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-4
                    ${selectedColor === 'black'
                      ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/10'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
                    }
                  `}
                >
                  <img src={KING_IMAGES.black} alt="Black King" className="w-16 h-16 drop-shadow-md" />
                  <div className="text-center">
                    <div className="font-bold text-white">Black</div>
                    <div className="text-xs text-slate-400 mt-1">Second Move</div>
                  </div>
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={!selectedColor}
                  className={`
                    flex-[2] py-3 rounded-lg font-bold text-gray-900 transition-colors
                    ${selectedColor
                      ? 'bg-yellow-500 hover:bg-yellow-400 shadow-lg shadow-yellow-500/20'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }
                  `}
                >
                  Create Room
                </button>
              </div>
            </div>
          )}

          {/* 대기 중 */}
          {mode === 'create' && waiting && (
            <div className="bg-slate-800/50 border border-gray-700 rounded-xl p-8 text-center">
              <div className="inline-block p-4 rounded-full bg-slate-900 mb-6 relative">
                <div className="text-4xl animate-pulse">⏳</div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Waiting for Opponent</h2>
              <p className="text-slate-400 mb-8">Share this room code with your friend.</p>

              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8 max-w-xs mx-auto relative group">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Room Code</div>
                <div className="text-4xl font-mono font-bold text-yellow-500 tracking-wider select-all">
                  {roomCode}
                </div>
                <button
                  onClick={handleCopyRoomCode}
                  className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity rounded-lg"
                >
                  <span className="font-semibold text-white">Click to Copy</span>
                </button>
              </div>

              <button
                onClick={handleCancel}
                className="py-2 px-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-semibold transition-colors border border-rose-500/20"
              >
                Cancel Room
              </button>
            </div>
          )}

          {/* 방 참가하기 */}
          {mode === 'join' && (
            <div className="bg-slate-800/50 border border-gray-700 rounded-xl p-8">
              <h2 className="text-xl font-semibold mb-6 text-center">Join Existing Room</h2>
              <div className="max-w-xs mx-auto">
                <input
                  type="text"
                  value={inputRoomCode}
                  onChange={(e) => {
                    setInputRoomCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  placeholder="ENTER CODE"
                  maxLength={6}
                  className="w-full px-4 py-4 bg-slate-900 border border-slate-700 rounded-lg text-center text-2xl font-mono font-bold tracking-widest text-white placeholder-slate-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 focus:outline-none transition-colors mb-2"
                />
                {error && (
                  <div className="text-rose-400 text-sm text-center mb-4 bg-rose-900/20 py-1 px-2 rounded">
                    {error}
                  </div>
                )}

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    disabled={inputRoomCode.length !== 6}
                    className={`
                      flex-[2] py-3 rounded-lg font-bold text-gray-900 transition-colors
                      ${inputRoomCode.length === 6
                        ? 'bg-yellow-500 hover:bg-yellow-400 shadow-lg shadow-yellow-500/20'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }
                    `}
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
