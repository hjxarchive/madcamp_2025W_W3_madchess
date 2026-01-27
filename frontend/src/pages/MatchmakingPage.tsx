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
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#050505]/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
            <span className="uppercase tracking-widest text-xs font-bold">Back to Arena</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-white skew-x-12"></div>
            <div className="font-serif text-lg">
              <span className="text-[#D4FF00]">MAD</span>
              <span className="text-white">CHESS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-5xl font-serif font-light mb-12 text-center">
            <span className="text-white">MATCH</span>
            <span className="text-[#D4FF00]">MAKING</span>
          </h1>

          {/* 모드 선택 */}
          {mode === 'select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <button
                onClick={() => setMode('create')}
                className="group border border-gray-800 hover:border-[#D4FF00] bg-transparent p-10 text-left transition-all duration-300"
              >
                <div className="text-5xl mb-6 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all">🏠</div>
                <h3 className="text-2xl font-serif text-white mb-2 group-hover:text-[#D4FF00] transition-colors">Create Room</h3>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Host a private match</p>
              </button>

              <button
                onClick={() => setMode('join')}
                className="group border border-gray-800 hover:border-[#D4FF00] bg-transparent p-10 text-left transition-all duration-300"
              >
                <div className="text-5xl mb-6 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all">🚪</div>
                <h3 className="text-2xl font-serif text-white mb-2 group-hover:text-[#D4FF00] transition-colors">Join Room</h3>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Enter with a code</p>
              </button>
            </div>
          )}

          {/* 방 만들기 */}
          {mode === 'create' && !waiting && (
            <div className="border border-gray-800 p-10">
              <h2 className="text-2xl font-serif mb-8 text-center">Select Your Side</h2>
              <div className="grid grid-cols-2 gap-8 mb-10">
                <button
                  onClick={() => setSelectedColor('white')}
                  className={`
                    p-8 border-2 transition-all duration-200 flex flex-col items-center gap-4
                    ${selectedColor === 'white'
                      ? 'border-[#D4FF00] bg-[#D4FF00]/5'
                      : 'border-gray-800 hover:border-gray-600'
                    }
                  `}
                >
                  <img src={KING_IMAGES.white} alt="White King" className="w-20 h-20" />
                  <div className="text-center">
                    <div className="font-serif text-xl text-white">WHITE</div>
                    <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">First Move</div>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedColor('black')}
                  className={`
                    p-8 border-2 transition-all duration-200 flex flex-col items-center gap-4
                    ${selectedColor === 'black'
                      ? 'border-[#D4FF00] bg-[#D4FF00]/5'
                      : 'border-gray-800 hover:border-gray-600'
                    }
                  `}
                >
                  <img src={KING_IMAGES.black} alt="Black King" className="w-20 h-20" />
                  <div className="text-center">
                    <div className="font-serif text-xl text-white">BLACK</div>
                    <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">Second Move</div>
                  </div>
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-4 border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white uppercase tracking-widest text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={!selectedColor}
                  className={`
                    flex-[2] py-4 font-bold uppercase tracking-widest text-sm transition-all
                    ${selectedColor
                      ? 'bg-[#D4FF00] text-black hover:bg-white'
                      : 'bg-gray-900 text-gray-600 cursor-not-allowed'
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
            <div className="border border-gray-800 p-10 text-center">
              <div className="inline-block mb-8">
                <div className="text-6xl animate-pulse">⏳</div>
              </div>
              <h2 className="text-3xl font-serif text-white mb-2">Waiting for Opponent</h2>
              <p className="text-gray-500 mb-10 uppercase tracking-widest text-sm">Share this room code</p>

              <div className="bg-[#0A0A0A] border border-gray-800 p-8 mb-10 max-w-xs mx-auto relative group cursor-pointer" onClick={handleCopyRoomCode}>
                <div className="text-xs text-gray-600 uppercase tracking-widest mb-2">Room Code</div>
                <div className="text-5xl font-mono font-bold text-[#D4FF00] tracking-wider select-all">
                  {roomCode}
                </div>
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="uppercase tracking-widest text-sm font-bold text-white">Click to Copy</span>
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="py-3 px-10 border border-red-900 text-red-500 hover:bg-red-900/20 uppercase tracking-widest text-sm font-bold transition-colors"
              >
                Cancel Room
              </button>
            </div>
          )}

          {/* 방 참가하기 */}
          {mode === 'join' && (
            <div className="border border-gray-800 p-10">
              <h2 className="text-2xl font-serif mb-8 text-center">Join Existing Room</h2>
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
                  className="w-full px-4 py-5 bg-[#0A0A0A] border border-gray-800 text-center text-3xl font-mono font-bold tracking-widest text-white placeholder-gray-700 focus:border-[#D4FF00] focus:outline-none transition-colors mb-4"
                />
                {error && (
                  <div className="text-red-500 text-sm text-center mb-4 py-2 px-4 border border-red-900 bg-red-900/10">
                    {error}
                  </div>
                )}

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-4 border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white uppercase tracking-widest text-sm font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    disabled={inputRoomCode.length !== 6}
                    className={`
                      flex-[2] py-4 font-bold uppercase tracking-widest text-sm transition-all
                      ${inputRoomCode.length === 6
                        ? 'bg-[#D4FF00] text-black hover:bg-white'
                        : 'bg-gray-900 text-gray-600 cursor-not-allowed'
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
