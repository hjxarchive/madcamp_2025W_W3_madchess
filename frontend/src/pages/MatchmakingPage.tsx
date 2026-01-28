
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { RatingRange } from '../components/rating/RatingDisplay'

const KING_IMAGES = {
  white: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  black: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
}

type Mode = 'select' | 'create' | 'join' | 'quick' | 'ai'

const TIME_CONTROLS = {
  bullet: [
    { label: '1 min', value: '1+0' },
    { label: '1 | 1', value: '1+1' },
    { label: '2 | 1', value: '2+1' },
  ],
  blitz: [
    { label: '3 min', value: '3+0' },
    { label: '3 | 2', value: '3+2' },
    { label: '5 min', value: '5+0' },
  ],
  rapid: [
    { label: '10 min', value: '10+0' },
    { label: '15 | 10', value: '15+10' },
    { label: '30 min', value: '30+0' },
  ]
}

export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('select')
  const [selectedColor, setSelectedColor] = useState<'white' | 'black' | null>(null)

  // Quick Match State
  const [timeCategory, setTimeCategory] = useState<'bullet' | 'blitz' | 'rapid'>('blitz')
  const [selectedTime, setSelectedTime] = useState<string>('3+0')
  const [isQueueing, setIsQueueing] = useState(false)

  const [roomCode, setRoomCode] = useState('')
  const [inputRoomCode, setInputRoomCode] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuthStore()

  // AI Mode State
  const [aiDifficulty, setAiDifficulty] = useState<number>(5)
  const [isStartingAI, setIsStartingAI] = useState(false)

  // WebSocket 연결
  useEffect(() => {
    socketService.connect()

    // 게임 매칭 성공 (Quick Match)
    socketService.onGameFound((data) => {
      console.log('Game found:', data)
      sessionStorage.setItem('matchId', data.matchId)
      if (data.yourColor) {
        sessionStorage.setItem('selectedColor', data.yourColor)
      }
      // Store opponent info for GamePage
      if (data.opponent) {
        sessionStorage.setItem('opponentInfo', JSON.stringify(data.opponent))
      }
      navigate(`/placement/${data.matchId}`)
    })

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
      // Store opponent (guest) info
      if (data.guest) {
        sessionStorage.setItem('opponentInfo', JSON.stringify(data.guest))
      }
      navigate(`/placement/${data.matchId}`)
    })

    // 게스트: 방 참가 성공
    socketService.onRoomJoined((data) => {
      console.log('Joined room:', data)
      // 참가 성공하면 배치 페이지로 이동
      const myColor = data.room.guest.color
      sessionStorage.setItem('selectedColor', myColor)
      sessionStorage.setItem('matchId', data.matchId)
      // Store opponent (host) info
      if (data.room.host) {
        sessionStorage.setItem('opponentInfo', JSON.stringify(data.room.host))
      }
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
      socketService.offGameFound()
      socketService.offRoomCreated()
      socketService.offPlayerJoined()
      socketService.offRoomJoined()
      socketService.offRoomError()
      socketService.offPlayerLeft()
    }
  }, [navigate, selectedColor])

  const handleCreateRoom = () => {
    if (!selectedColor) return

    // 실제 로그인된 사용자 ID 사용 (DB 저장 위해 숫자 ID 필요)
    const userId = user?.id ? String(user.id) : `guest-${Date.now()}`
    const deckId = 'default-deck'

    socketService.createRoom(userId, deckId, selectedColor, user?.name, user?.picture, user?.rating)
  }

  const handleJoinRoom = () => {
    if (!inputRoomCode.trim()) {
      setError('방 코드를 입력해주세요')
      return
    }

    const userId = user?.id ? String(user.id) : `guest-${Date.now()}`
    const deckId = 'default-deck'

    socketService.joinRoom(inputRoomCode.trim().toUpperCase(), userId, deckId, user?.name, user?.picture, user?.rating)
  }

  const handleQuickMatch = () => {
    setIsQueueing(true)
    const userId = user?.id ? String(user.id) : `guest-${Date.now()}`
    const deckId = 'default-deck'
    socketService.joinQueue(userId, deckId, selectedTime, user?.name, user?.picture, user?.rating)
  }

  const handleStartAI = () => {
    if (!selectedColor) return
    setIsStartingAI(true)

    const userId = user?.id ? String(user.id) : `guest-${Date.now()}`
    const deckId = 'default-deck'

    socketService.createAIGame(
      userId,
      deckId,
      selectedColor as any,
      aiDifficulty,
      user?.name,
      user?.picture,
      user?.rating
    )
  }

  const handleCancelQueue = () => {
    socketService.leaveQueue()
    setIsQueueing(false)
    // Don't switch mode immediately, let user cancel queue but stay in quick match screen? 
    // Or go back to select. Let's stay in quick match screen.
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
    if (isQueueing) {
      socketService.leaveQueue()
      setIsQueueing(false)
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
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
            <div className="w-6 h-6 bg-white skew-x-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-80"></div>
            </div>
            <div className="font-serif text-lg">
              <span className="text-[#D4FF00]">MAD</span>
              <span className="text-white">CHESS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-serif font-light mb-12 text-center">
            <span className="text-white">MATCH</span>
            <span className="text-[#D4FF00]">MAKING</span>
          </h1>

          {/* 모드 선택 */}
          {mode === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setMode('quick')}
                className="group border border-gray-800 hover:border-[#D4FF00] bg-transparent p-8 text-left transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 font-serif text-6xl group-hover:scale-110 transition-transform">⚡</div>
                <div className="text-4xl mb-6 opacity-60 group-hover:opacity-100 transition-all">⚡</div>
                <h3 className="text-2xl font-serif text-white mb-2 group-hover:text-[#D4FF00] transition-colors">Quick Match</h3>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Find opponent</p>
              </button>

              <button
                onClick={() => setMode('create')}
                className="group border border-gray-800 hover:border-[#D4FF00] bg-transparent p-8 text-left transition-all duration-300"
              >
                <div className="text-4xl mb-6 opacity-60 group-hover:opacity-100 transition-all">🏠</div>
                <h3 className="text-2xl font-serif text-white mb-2 group-hover:text-[#D4FF00] transition-colors">Create Room</h3>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Host private match</p>
              </button>

              <button
                onClick={() => setMode('join')}
                className="group border border-gray-800 hover:border-[#D4FF00] bg-transparent p-8 text-left transition-all duration-300"
              >
                <div className="text-4xl mb-6 opacity-60 group-hover:opacity-100 transition-all">🚪</div>
                <h3 className="text-2xl font-serif text-white mb-2 group-hover:text-[#D4FF00] transition-colors">Join Room</h3>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Enter code</p>
              </button>

              <button
                onClick={() => setMode('ai')}
                className="group border border-gray-800 hover:border-[#D4FF00] bg-transparent p-8 text-left transition-all duration-300 relative bg-[#D4FF00]/5"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 font-serif text-6xl group-hover:scale-110 transition-transform">🤖</div>
                <div className="text-4xl mb-6 opacity-60 group-hover:opacity-100 transition-all">🤖</div>
                <h3 className="text-2xl font-serif text-white mb-2 group-hover:text-[#D4FF00] transition-colors">Play with AI</h3>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Challenge Stockfish</p>
              </button>
            </div>
          )}

          {/* Quick Match - Time Selection */}
          {mode === 'quick' && !isQueueing && (
            <div className="border border-gray-800 p-8">
              <h2 className="text-2xl font-serif mb-8 text-center">Select Time Control</h2>

              {/* Tabs */}
              <div className="flex justify-center mb-8 border-b border-gray-800">
                {(['bullet', 'blitz', 'rapid'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setTimeCategory(cat)}
                    className={`px-8 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${timeCategory === cat
                      ? 'text-[#D4FF00] border-[#D4FF00]'
                      : 'text-gray-500 border-transparent hover:text-white'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Time Options */}
              <div className="grid grid-cols-3 gap-4 mb-10">
                {TIME_CONTROLS[timeCategory].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTime(option.value)}
                    className={`p-6 border transition-all ${selectedTime === option.value
                      ? 'border-[#D4FF00] bg-[#D4FF00]/10 text-white'
                      : 'border-gray-800 hover:border-gray-600 text-gray-400'
                      }`}
                  >
                    <div className="text-xl font-bold font-mono">{option.label}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-4 border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white uppercase tracking-widest text-sm font-bold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleQuickMatch}
                  className="flex-[2] py-4 bg-[#D4FF00] text-black hover:bg-white font-bold uppercase tracking-widest text-sm transition-all"
                >
                  Find Match
                </button>
              </div>
            </div>
          )}

          {/* Quick Match - Queueing */}
          {mode === 'quick' && isQueueing && (
            <div className="border border-gray-800 p-10 text-center">
              <div className="inline-block mb-8">
                <div className="text-6xl animate-pulse">🔍</div>
              </div>
              <h2 className="text-3xl font-serif text-white mb-2">Searching for Opponent</h2>
              <p className="text-gray-500 mb-4 uppercase tracking-widest text-sm">
                Time Control: <span className="text-[#D4FF00] font-mono">{selectedTime}</span>
              </p>

              {/* 내 레이팅 및 예상 매칭 범위 */}
              {user?.rating && (
                <div className="mb-8 p-4 border border-gray-800 bg-[#0A0A0A] rounded inline-block">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">예상 상대 레이팅</div>
                  <RatingRange 
                    minRating={(user.rating || 1500) - (user.rd || 350) * 2}
                    maxRating={(user.rating || 1500) + (user.rd || 350) * 2}
                    className="text-lg"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    내 레이팅: <span className="text-[#D4FF00]">{Math.round(user.rating)}</span>
                    {user.rd && user.rd > 100 && <span className="ml-2">(불확실성 높음)</span>}
                  </div>
                </div>
              )}

              <button
                onClick={handleCancelQueue}
                className="py-3 px-10 border border-red-900 text-red-500 hover:bg-red-900/20 uppercase tracking-widest text-sm font-bold transition-colors"
              >
                Cancel Search
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

          {/* 대기 중 (Create Room) */}
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

          {/* AI 대전 설정 */}
          {mode === 'ai' && (
            <div className="border border-gray-800 p-10">
              <h2 className="text-2xl font-serif mb-8 text-center">AI Battle Settings</h2>

              <div className="mb-10">
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-4 text-center font-bold">Difficulty Level (1-10)</label>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 font-bold">EASY</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(parseInt(e.target.value))}
                    className="flex-1 accent-[#D4FF00] bg-gray-900"
                  />
                  <span className="text-[#D4FF00] font-mono text-xl font-bold">{aiDifficulty}</span>
                  <span className="text-gray-500 font-bold">HARD</span>
                </div>
              </div>

              <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4 text-center font-bold">Select Your Side</h2>
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
                  onClick={handleStartAI}
                  disabled={!selectedColor || isStartingAI}
                  className={`
                    flex-[2] py-4 font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3
                    ${selectedColor && !isStartingAI
                      ? 'bg-[#D4FF00] text-black hover:bg-white'
                      : 'bg-gray-900 text-gray-600 cursor-not-allowed'
                    }
                  `}
                >
                  {isStartingAI && <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>}
                  Start AI Game
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
