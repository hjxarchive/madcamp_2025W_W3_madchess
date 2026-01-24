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
    navigator.clipboard.writeText(roomCode)
    alert('방 코드가 복사되었습니다!')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800 rounded-lg p-8 shadow-2xl">
          <h1 className="text-4xl font-bold mb-2 text-center">매칭</h1>

          {/* 모드 선택 */}
          {mode === 'select' && (
            <>
              <p className="text-gray-400 text-center mb-8">
                게임 모드를 선택해주세요
              </p>
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => setMode('create')}
                  className="p-8 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors border-2 border-blue-500"
                >
                  <div className="text-2xl mb-2">🏠</div>
                  <div className="text-xl font-bold mb-2">방 만들기</div>
                  <div className="text-sm text-gray-300">
                    친구와 플레이하기
                  </div>
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="p-8 rounded-lg bg-green-600 hover:bg-green-700 transition-colors border-2 border-green-500"
                >
                  <div className="text-2xl mb-2">🚪</div>
                  <div className="text-xl font-bold mb-2">방 참가하기</div>
                  <div className="text-sm text-gray-300">
                    방 코드로 입장
                  </div>
                </button>
              </div>
            </>
          )}

          {/* 방 만들기 */}
          {mode === 'create' && !waiting && (
            <>
              <p className="text-gray-400 text-center mb-8">
                선/후공을 선택해주세요
              </p>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <button
                  onClick={() => setSelectedColor('white')}
                  className={`
                    p-8 rounded-lg transition-all duration-300 border-2
                    ${selectedColor === 'white'
                      ? 'border-blue-500 bg-blue-900 shadow-lg'
                      : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                    }
                  `}
                >
                  <div className="flex justify-center mb-4">
                    <img src={KING_IMAGES.white} alt="White King" className="w-20 h-20" />
                  </div>
                  <div className="text-xl font-bold mb-2 text-center">선공 (백)</div>
                  <div className="text-sm text-gray-300 text-center">
                    먼저 움직입니다
                  </div>
                </button>
                <button
                  onClick={() => setSelectedColor('black')}
                  className={`
                    p-8 rounded-lg transition-all duration-300 border-2
                    ${selectedColor === 'black'
                      ? 'border-blue-500 bg-blue-900 shadow-lg'
                      : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                    }
                  `}
                >
                  <div className="flex justify-center mb-4">
                    <img src={KING_IMAGES.black} alt="Black King" className="w-20 h-20" />
                  </div>
                  <div className="text-xl font-bold mb-2 text-center">후공 (흑)</div>
                  <div className="text-sm text-gray-300 text-center">
                    상대가 먼저 움직입니다
                  </div>
                </button>
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={!selectedColor}
                className={`
                  w-full py-3 rounded-lg font-bold text-lg transition-colors mb-3
                  ${selectedColor
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                방 만들기
              </button>
            </>
          )}

          {/* 대기 중 */}
          {mode === 'create' && waiting && (
            <>
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-2xl font-bold mb-4">상대 대기 중...</h2>
                <p className="text-gray-400 mb-6">
                  친구에게 방 코드를 공유하세요
                </p>
                <div className="bg-gray-700 rounded-lg p-6 mb-4">
                  <div className="text-sm text-gray-400 mb-2">방 코드</div>
                  <div className="text-4xl font-bold tracking-wider mb-4">
                    {roomCode}
                  </div>
                  <button
                    onClick={handleCopyRoomCode}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                  >
                    📋 복사하기
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 방 참가하기 */}
          {mode === 'join' && (
            <>
              <p className="text-gray-400 text-center mb-8">
                방 코드를 입력해주세요
              </p>
              <div className="mb-6">
                <input
                  type="text"
                  value={inputRoomCode}
                  onChange={(e) => {
                    setInputRoomCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  placeholder="6자리 코드 입력"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-center text-2xl font-bold tracking-wider focus:border-blue-500 focus:outline-none"
                />
                {error && (
                  <div className="mt-2 text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}
              </div>
              <button
                onClick={handleJoinRoom}
                disabled={inputRoomCode.length !== 6}
                className={`
                  w-full py-3 rounded-lg font-bold text-lg transition-colors mb-3
                  ${inputRoomCode.length === 6
                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                참가하기
              </button>
            </>
          )}

          {/* 취소 버튼 */}
          {mode !== 'select' && (
            <button
              onClick={handleCancel}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold transition-colors"
            >
              {waiting ? '취소' : '뒤로 가기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
