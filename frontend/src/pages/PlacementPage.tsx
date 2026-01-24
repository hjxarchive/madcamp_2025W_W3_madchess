import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PieceType, PieceColor, PIECE_COSTS, PIECE_MAX_COUNT, PlacedPiece, File, Rank } from '../types/game'
import { socketService } from '../services/socket'

interface AvailablePiece {
  type: PieceType
  count: number
}

// 기물 이미지 URL
const PIECE_IMAGES: Record<PieceColor, Record<PieceType, string>> = {
  white: {
    k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  },
  black: {
    k: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
    q: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    r: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    b: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    n: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    p: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
  },
}

const FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

export default function PlacementPage() {
  const navigate = useNavigate()
  const { gameId } = useParams<{ gameId: string }>()

  const [myColor, setMyColor] = useState<PieceColor>('white')
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([])
  const [draggedPiece, setDraggedPiece] = useState<{ type: PieceType; index: number } | null>(null)
  const [usedBudget, setUsedBudget] = useState(0)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)

  // 초기화: sessionStorage에서 색상 정보 읽기 및 킹 자동 배치
  useEffect(() => {
    const savedColor = sessionStorage.getItem('selectedColor') as PieceColor | null
    if (savedColor) {
      setMyColor(savedColor)
      sessionStorage.removeItem('selectedColor')

      // 킹을 자동으로 배치 (e1 또는 e8)
      const kingRank: Rank = savedColor === 'white' ? 1 : 8
      setPlacedPieces([{ type: 'k', file: 'e', rank: kingRank }])
    }
  }, [])

  // 개발 모드에서 테스트 함수 노출
  useEffect(() => {
    if (import.meta.env.DEV) {
      // 더미 배치 생성
      const createDummyPlacement = (color: PieceColor): PlacedPiece[] => {
        const baseRank = color === 'white' ? 1 : 8
        const pawnRank = color === 'white' ? 2 : 7
        return [
          { type: 'k', file: 'e', rank: baseRank },
          { type: 'q', file: 'd', rank: baseRank },
          { type: 'r', file: 'a', rank: baseRank },
          { type: 'r', file: 'h', rank: baseRank },
          { type: 'b', file: 'c', rank: baseRank },
          { type: 'b', file: 'f', rank: baseRank },
          { type: 'n', file: 'b', rank: baseRank },
          { type: 'n', file: 'g', rank: baseRank },
          ...(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as File[]).map((file) => ({
            type: 'p' as PieceType,
            file,
            rank: pawnRank as Rank,
          })),
        ]
      }

      // 테스트: 내 배치 자동 완성
      (window as any).testAutoPlacement = () => {
        const dummyPlacement = createDummyPlacement(myColor)
        setPlacedPieces(dummyPlacement)
        console.log('✅ 자동 배치 완료:', dummyPlacement)
      }

      // 테스트: 배치 전송 (서버로)
      (window as any).testSendPlacement = () => {
        if (!gameId) {
          console.error('❌ gameId가 없습니다')
          return
        }
        if (placedPieces.length === 0) {
          console.error('❌ 배치된 기물이 없습니다')
          return
        }
        socketService.sendPlacement(gameId, {
          color: myColor,
          placement: placedPieces,
        })
        console.log('📤 배치 전송:', { color: myColor, placement: placedPieces, gameId })
      }

      // 테스트: 상대 배치 수신 시뮬레이션
      (window as any).testReceivePlacement = () => {
        const opponentColor = myColor === 'white' ? 'black' : 'white'
        const opponentPlacement = createDummyPlacement(opponentColor)

        // placement:complete 이벤트 시뮬레이션
        sessionStorage.setItem('placedPieces', JSON.stringify(placedPieces))
        sessionStorage.setItem('myColor', myColor)
        sessionStorage.setItem('opponentPlacement', JSON.stringify(opponentPlacement))

        console.log('📥 상대 배치 수신 시뮬레이션:', opponentPlacement)
        console.log('🎮 게임 페이지로 이동:', `/game/${gameId}`)

        if (gameId) {
          navigate(`/game/${gameId}`)
        }
      }

      // 테스트: 상대 배치 완료 이벤트 시뮬레이션 (내가 보낸 후 상대 배치 수신)
      (window as any).testSimulateOpponentComplete = () => {
        if (!waitingForOpponent) {
          console.warn('⚠️ 먼저 testSendPlacement()로 내 배치를 보내세요')
          return
        }

        const opponentColor = myColor === 'white' ? 'black' : 'white'
        const opponentPlacement = createDummyPlacement(opponentColor)

        console.log('✅ 상대가 배치 완료! placement:complete 이벤트 시뮬레이션')
        console.log('📥 상대 배치:', opponentPlacement)

        // placement:complete 이벤트 핸들러와 동일하게 처리
        sessionStorage.setItem('placedPieces', JSON.stringify(placedPieces))
        sessionStorage.setItem('myColor', myColor)
        sessionStorage.setItem('opponentPlacement', JSON.stringify(opponentPlacement))

        setWaitingForOpponent(false)

        if (gameId) {
          console.log('🎮 게임 시작! 페이지 이동:', `/game/${gameId}`)
          navigate(`/game/${gameId}`)
        }
      }

      // 테스트: placement:waiting 이벤트 시뮬레이션
      (window as any).testPlacementWaiting = () => {
        console.log('⏳ placement:waiting 이벤트 시뮬레이션')
        alert('배치를 제출했습니다. 상대방의 배치를 기다리는 중...')
      }

      console.log('🎮 배치 테스트 함수 사용 가능:')
      console.log('  testAutoPlacement() - 자동으로 모든 기물 배치')
      console.log('  testSendPlacement() - 현재 배치를 서버로 전송 (대기 상태로 전환)')
      console.log('  testSimulateOpponentComplete() - 상대 배치 수신 시뮬레이션 (게임 시작)')
      console.log('  testReceivePlacement() - 전체 플로우 시뮬레이션 (바로 게임 페이지)')
      console.log('  testPlacementWaiting() - 대기 알림 시뮬레이션')
      console.log('')
      console.log('🔄 정상 플로우: testAutoPlacement() → testSendPlacement() → testSimulateOpponentComplete()')
    }

    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).testAutoPlacement
        delete (window as any).testSendPlacement
        delete (window as any).testReceivePlacement
        delete (window as any).testSimulateOpponentComplete
        delete (window as any).testPlacementWaiting
      }
    }
  }, [myColor, placedPieces, gameId, navigate, waitingForOpponent])

  // 배치 가능한 구역 - white: 1~4행, black: 5~8행
  const placementRanks = myColor === 'white' ? [1, 2, 3, 4] : [5, 6, 7, 8]
  const isPlacementArea = (rank: Rank) => placementRanks.includes(rank)

  // 사용 가능한 기물 목록
  const getAvailablePieces = (): AvailablePiece[] => {
    const pieces: AvailablePiece[] = []
    const pieceTypes: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p']

    pieceTypes.forEach((type) => {
      const maxCount = PIECE_MAX_COUNT[type]
      const placedCount = placedPieces.filter(p => p.type === type).length
      const remaining = maxCount - placedCount

      if (remaining > 0) {
        pieces.push({ type, count: remaining })
      }
    })

    return pieces
  }

  // 사용한 예산 계산
  useEffect(() => {
    const total = placedPieces.reduce((sum, piece) => {
      return sum + PIECE_COSTS[piece.type]
    }, 0)
    setUsedBudget(total)
  }, [placedPieces])

  // 드래그 시작
  const handleDragStart = (type: PieceType, index: number) => {
    setDraggedPiece({ type, index })
  }

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // 드롭
  const handleDrop = (file: File, rank: Rank, e: React.DragEvent) => {
    e.preventDefault()

    if (!draggedPiece) return

    // 배치 가능 구역 확인
    if (!isPlacementArea(rank)) {
      alert('자신의 진영에만 배치할 수 있습니다')
      return
    }

    // 킹 위치 체크
    const kingRank: Rank = myColor === 'white' ? 1 : 8
    const isKingPosition = file === 'e' && rank === kingRank

    // 킹은 e1/e8에만 배치 가능
    if (draggedPiece.type === 'k') {
      if (!isKingPosition) {
        alert('킹은 e1 또는 e8에만 배치할 수 있습니다')
        return
      }
    } else {
      // 킹이 아닌 기물은 킹 위치에 배치 불가
      if (isKingPosition) {
        alert('킹 위치에는 킹만 배치할 수 있습니다')
        return
      }
    }

    // 이미 기물이 있으면 제거
    setPlacedPieces(prev =>
      prev.filter(p => !(p.file === file && p.rank === rank))
    )

    // 새 기물 배치
    const newPiece: PlacedPiece = {
      type: draggedPiece.type,
      file,
      rank,
    }

    setPlacedPieces(prev => [...prev, newPiece])
    setDraggedPiece(null)
  }

  // 보드 칸 클릭해서 기물 제거
  const handleSquareClick = (file: File, rank: Rank) => {
    const clickedPiece = placedPieces.find(p => p.file === file && p.rank === rank)

    // 킹은 제거할 수 없음
    if (clickedPiece?.type === 'k') {
      alert('킹은 제거할 수 없습니다')
      return
    }

    setPlacedPieces(prev =>
      prev.filter(p => !(p.file === file && p.rank === rank))
    )
  }

  // WebSocket 이벤트 리스너 설정
  useEffect(() => {
    // 상대방 배치가 완료되고 게임 시작
    socketService.onPlacementComplete((data) => {
      console.log('✅ Both placements complete, starting game:', data)

      // sessionStorage에 저장
      sessionStorage.setItem('placedPieces', JSON.stringify(placedPieces))
      sessionStorage.setItem('myColor', myColor)
      sessionStorage.setItem('opponentPlacement', JSON.stringify(data.opponentPlacement))

      setWaitingForOpponent(false)

      // 게임 페이지로 이동
      if (gameId) {
        navigate(`/game/${gameId}`)
      }
    })

    // 상대가 배치 중임을 알림
    socketService.onPlacementWaiting(() => {
      console.log('⏳ Waiting for opponent placement...')
      setWaitingForOpponent(true)
    })

    // 배치 에러 처리
    socketService.onPlacementError((data) => {
      console.error('❌ Placement error:', data.message)
      alert(`배치 오류: ${data.message}`)
      setWaitingForOpponent(false)
    })

    return () => {
      socketService.offPlacementComplete()
      socketService.offPlacementWaiting()
      socketService.offPlacementError()
    }
  }, [placedPieces, myColor, gameId, navigate])

  // 배치 완료
  const handleConfirmPlacement = () => {
    // 킹이 배치되었는지 확인
    const kingPlaced = placedPieces.some(p => p.type === 'k')
    if (!kingPlaced) {
      alert('킹을 배치해야 합니다')
      return
    }

    // 서버로 배치 정보 전송
    if (gameId) {
      socketService.sendPlacement(gameId, {
        color: myColor,
        placement: placedPieces,
      })
      console.log('📤 배치 전송:', { color: myColor, placement: placedPieces })

      // 대기 상태로 전환 (상대 배치를 기다림)
      // placement:complete 이벤트를 받아야 게임 페이지로 이동
      setWaitingForOpponent(true)
    }
  }

  const availablePieces = getAvailablePieces()
  const remainingBudget = 30 - usedBudget

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">기물 배치</h1>
          <p className="text-gray-400">
            {myColor === 'white' ? '백' : '흑'}으로 플레이합니다. 기물을 배치해주세요.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
          {/* 보드 영역 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="inline-block border-4 border-gray-700">
              {/* 보드 */}
              {Array.from({ length: 8 }).map((_, rankIdx) => {
                const rank = (myColor === 'black' ? rankIdx + 1 : 8 - rankIdx) as Rank
                const isPlacementRank = isPlacementArea(rank)

                return (
                  <div key={rank} className="flex">
                    {FILES.map((file) => {
                      // const displayFile = myColor === 'black' ? FILES[7 - FILES.indexOf(file)] : file
                      const isLight = (FILES.indexOf(file) + (8 - rank)) % 2 === 0
                      const placedPiece = placedPieces.find(p => p.file === file && p.rank === rank)
                      const kingRank: Rank = myColor === 'white' ? 1 : 8
                      const isMyKingSpot = file === 'e' && rank === kingRank
                      const oppKingRank: Rank = myColor === 'white' ? 8 : 1
                      const isOppKingSpot = file === 'e' && rank === oppKingRank

                      return (
                        <div
                          key={`${file}-${rank}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(file, rank, e)}
                          onClick={() => placedPiece && handleSquareClick(file, rank)}
                          className={`
                            w-16 h-16 flex items-center justify-center cursor-move relative
                            transition-all duration-200
                            ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                            ${!isPlacementRank ? 'opacity-30' : ''}
                            ${placedPiece ? 'ring-2 ring-yellow-400' : ''}
                            ${isMyKingSpot && placedPiece?.type === 'k' ? 'ring-4 ring-green-500' : ''}
                            ${isOppKingSpot ? 'ring-4 ring-red-500' : ''}
                          `}
                        >
                          {/* 자신의 킹 위치 표시 */}
                          {isMyKingSpot && !placedPiece && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                              <span className="text-4xl">♚</span>
                            </div>
                          )}

                          {/* 상대 킹 위치 표시 (빨간 테두리로 표시) */}
                          {isOppKingSpot && !placedPiece && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                              <span className="text-4xl">♔</span>
                            </div>
                          )}

                          {/* 배치된 기물 */}
                          {placedPiece && (
                            <img
                              src={PIECE_IMAGES[myColor][placedPiece.type]}
                              alt={placedPiece.type}
                              className="w-12 h-12 cursor-pointer hover:opacity-75"
                              draggable={false}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* 배치 정보 */}
            <div className="mt-6 p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="font-semibold">예산 사용: {usedBudget}/30</span>
                <span className="text-blue-400">
                  {remainingBudget > 0 ? `${remainingBudget}점 남음` : '예산 모두 사용'}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all bg-blue-500"
                  style={{ width: `${Math.min(usedBudget / 30 * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 기물 선택 영역 */}
          <div className="bg-gray-800 rounded-lg p-6 w-full lg:w-64 h-fit">
            <h2 className="text-xl font-bold mb-4">배치할 기물</h2>

            {availablePieces.length === 0 ? (
              <p className="text-gray-400 text-center py-8">배치할 기물이 없습니다</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {availablePieces.map((piece) => (
                  <div key={piece.type} className="space-y-2">
                    <div className="text-sm font-semibold flex justify-between">
                      <span>{getPieceName(piece.type)}</span>
                      <span className="text-xs text-gray-400">
                        {piece.count}/{PIECE_MAX_COUNT[piece.type]}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: piece.count }).map((_, idx) => (
                        <div
                          key={`${piece.type}-${idx}`}
                          draggable
                          onDragStart={() => handleDragStart(piece.type, idx)}
                          className="
                            w-12 h-12 flex items-center justify-center
                            bg-gray-700 hover:bg-gray-600 rounded-lg cursor-grab
                            active:cursor-grabbing border-2 border-gray-600
                            hover:border-gray-500 transition-colors
                          "
                        >
                          <img
                            src={PIECE_IMAGES[myColor][piece.type]}
                            alt={piece.type}
                            className="w-10 h-10"
                            draggable={false}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-gray-400">
                      {PIECE_COSTS[piece.type]}점
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleConfirmPlacement}
                disabled={!placedPieces.some(p => p.type === 'k') || waitingForOpponent}
                className={`
                  w-full py-2 rounded-lg font-semibold transition-colors
                  ${waitingForOpponent
                    ? 'bg-yellow-600 text-white cursor-wait'
                    : placedPieces.some(p => p.type === 'k')
                      ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {waitingForOpponent ? '⏳ 상대방 배치 대기 중...' : '배치 완료'}
              </button>
              <button
                onClick={() => navigate('/')}
                disabled={waitingForOpponent}
                className={`
                  w-full py-2 rounded-lg font-semibold transition-colors
                  ${waitingForOpponent
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }
                `}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 기물 이름
function getPieceName(type: PieceType): string {
  const names: Record<PieceType, string> = {
    p: '폰',
    n: '나이트',
    b: '비숍',
    r: '룩',
    q: '퀸',
    k: '킹',
  }
  return names[type]
}
