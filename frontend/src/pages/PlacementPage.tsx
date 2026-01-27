import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PieceType, PieceColor, PIECE_COSTS, PIECE_MAX_COUNT, PlacedPiece, File, Rank } from '../types/game'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { getUserDecks } from '../services/userApi'
import type { DeckWithStats } from '../types/api.types'

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
  const [selectedPieceType, setSelectedPieceType] = useState<PieceType | null>(null)
  const [hoverSquare, setHoverSquare] = useState<{ file: File; rank: Rank } | null>(null)
  const [usedBudget, setUsedBudget] = useState(0)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)
  const [isLocked, setIsLocked] = useState(false) // Lock placement immediately when confirm is clicked

  // Timer state (2 minutes = 120 seconds)
  const [timeLeft, setTimeLeft] = useState(120)

  // Saved decks from database
  const { user } = useAuthStore()
  const [savedDecks, setSavedDecks] = useState<DeckWithStats[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null)

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

  // Fetch saved decks from database
  useEffect(() => {
    if (user?.id) {
      getUserDecks(user.id).then(res => {
        if (res?.success && res.data) {
          setSavedDecks(res.data)
        }
      }).catch(() => { })
    }
  }, [user])

  // Load a saved deck onto the board
  const handleLoadDeck = (deckId: number) => {
    const deck = savedDecks.find(d => d.id === deckId)
    if (!deck || !deck.placement) return

    // Convert API placement to PlacedPiece[] with correct ranks for color
    const baseRankOffset = myColor === 'white' ? 0 : 4  // white: 1-4, black: 5-8
    const newPlacement: PlacedPiece[] = []

    deck.placement.forEach((p: any) => {
      const pos = p.position || 'a1'
      const file = pos[0] as File
      let rank = parseInt(pos[1]) as Rank

      // Adjust rank for black player (mirror placement)
      if (myColor === 'black') {
        rank = (9 - rank) as Rank  // 1->8, 2->7, 3->6, 4->5
      }

      newPlacement.push({
        type: p.type as PieceType,
        file,
        rank
      })
    })

    // Ensure King is placed correctly
    const kingRank: Rank = myColor === 'white' ? 1 : 8
    const hasKing = newPlacement.some(p => p.type === 'k')
    if (!hasKing) {
      newPlacement.push({ type: 'k', file: 'e', rank: kingRank })
    } else {
      // Update King position to correct rank
      const kingIdx = newPlacement.findIndex(p => p.type === 'k')
      if (kingIdx >= 0) {
        newPlacement[kingIdx].rank = kingRank
        newPlacement[kingIdx].file = 'e'
      }
    }

    setPlacedPieces(newPlacement)
    setSelectedDeckId(deckId)
  }

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

  // 기물 클릭으로 선택
  const handlePieceSelect = (type: PieceType) => {
    if (isLocked || waitingForOpponent) return // 배치 완료 후 수정 불가
    if (type === 'k') return // 킹은 선택 불가
    // 이미 선택된 기물을 다시 클릭하면 선택 해제
    if (selectedPieceType === type) {
      setSelectedPieceType(null)
    } else {
      setSelectedPieceType(type)
    }
  }

  // 보드 칸 클릭으로 배치 또는 제거
  const handleSquareClick = (file: File, rank: Rank) => {
    if (isLocked || waitingForOpponent) return // 배치 완료 후 수정 불가
    const clickedPiece = placedPieces.find(p => p.file === file && p.rank === rank)

    // 기존 기물이 있으면 제거하고 선택 상태로 만들기
    if (clickedPiece) {
      if (clickedPiece.type === 'k') {
        alert('킹은 제거할 수 없습니다')
        return
      }
      setPlacedPieces(prev => prev.filter(p => !(p.file === file && p.rank === rank)))
      setSelectedPieceType(clickedPiece.type) // 제거한 기물을 선택 상태로
      return
    }

    // 선택된 기물이 없으면 리턴
    if (!selectedPieceType) return

    // 배치 가능 구역 확인
    if (!isPlacementArea(rank)) {
      alert('자신의 진영에만 배치할 수 있습니다')
      return
    }

    // 킹 위치 체크
    const kingRank: Rank = myColor === 'white' ? 1 : 8
    const isKingPosition = file === 'e' && rank === kingRank

    // 킹은 e1/e8에만 배치 가능
    if (selectedPieceType === 'k') {
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

    // 예산 검증: 30점 초과 확인
    const newPieceCost = PIECE_COSTS[selectedPieceType]
    const newBudget = usedBudget + newPieceCost

    if (newBudget > 30) {
      alert(`기물 점수가 30점을 초과할 수 없습니다 (현재: ${usedBudget}점, 추가 시: ${newBudget}점)`)
      return
    }

    // 새 기물 배치
    const newPiece: PlacedPiece = {
      type: selectedPieceType,
      file,
      rank,
    }

    setPlacedPieces(prev => [...prev, newPiece])
    setSelectedPieceType(null) // 배치 후 선택 해제
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
    // 즉시 잠금 (더 이상 수정 불가)
    setIsLocked(true)
    setSelectedPieceType(null)

    // 킹이 배치되었는지 확인
    const kingPlaced = placedPieces.some(p => p.type === 'k')
    if (!kingPlaced) {
      alert('킹을 배치해야 합니다')
      setIsLocked(false) // 잠금 해제
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

  // Timer countdown - auto-submit when time runs out
  useEffect(() => {
    // Don't run timer if already waiting for opponent or locked
    if (waitingForOpponent || isLocked) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up! Auto-submit
          clearInterval(timer)

          // Ensure King is placed before auto-submit
          const kingPlaced = placedPieces.some(p => p.type === 'k')
          if (kingPlaced && gameId) {
            socketService.sendPlacement(gameId, {
              color: myColor,
              placement: placedPieces,
            })
            console.log('⏰ 시간 종료! 자동 배치 전송:', { color: myColor, placement: placedPieces })
            setWaitingForOpponent(true)
            setIsLocked(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [waitingForOpponent, isLocked, gameId, myColor, placedPieces])

  const availablePieces = getAvailablePieces()

  // 배치된 기물 요약
  const placedSummary: Record<PieceType, number> = placedPieces.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1
    return acc
  }, {} as Record<PieceType, number>)

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-gray-900 bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-white skew-x-12"></div>
            <div className="font-serif text-lg">
              <span className="text-[#D4FF00]">MAD</span>
              <span className="text-white">CHESS</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500 uppercase tracking-widest">Placement Phase</div>
            <div className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] border border-gray-800">
              <span className="text-xs text-gray-500 uppercase">Time:</span>
              <span className={`font-mono text-lg ${timeLeft <= 30 ? 'text-red-500 animate-pulse' : 'text-[#D4FF00]'}`}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          {/* 보드 영역 */}
          <div className="flex flex-col gap-4">
            <div className="inline-block border-2 border-gray-700 rounded-lg overflow-hidden">
              {/* 보드 */}
              {Array.from({ length: 8 }).map((_, rankIdx) => {
                const rank = (myColor === 'black' ? rankIdx + 1 : 8 - rankIdx) as Rank
                const isPlacementRank = isPlacementArea(rank)
                // 흑일 경우 파일 순서를 반전 (h -> a)
                const displayFiles = myColor === 'black' ? [...FILES].reverse() : FILES

                return (
                  <div key={rank} className="flex">
                    {displayFiles.map((file) => {
                      const isLight = (FILES.indexOf(file) + (8 - rank)) % 2 === 0
                      const placedPiece = placedPieces.find(p => p.file === file && p.rank === rank)
                      const oppKingRank: Rank = myColor === 'white' ? 8 : 1
                      const isOppKingSpot = file === 'e' && rank === oppKingRank
                      const myKingRank: Rank = myColor === 'white' ? 1 : 8
                      const isMyKingSpot = file === 'e' && rank === myKingRank
                      const isHovered = hoverSquare?.file === file && hoverSquare?.rank === rank
                      const canPlaceHere = isPlacementRank && !placedPiece && selectedPieceType

                      return (
                        <div
                          key={`${file}-${rank}`}
                          onMouseEnter={() => setHoverSquare({ file, rank })}
                          onMouseLeave={() => setHoverSquare(null)}
                          onClick={() => handleSquareClick(file, rank)}
                          className={`
                            w-14 h-14 flex items-center justify-center relative
                            transition-all duration-200
                            ${isLight ? 'bg-slate-200' : 'bg-slate-600'}
                            ${isPlacementRank ? (isLight ? 'bg-amber-100' : 'bg-amber-700') : 'opacity-40'}
                            ${placedPiece ? 'cursor-pointer hover:opacity-80' : isPlacementRank && selectedPieceType ? 'cursor-pointer' : isPlacementRank ? 'cursor-default' : 'cursor-not-allowed'}
                            ${isOppKingSpot ? 'ring-2 ring-inset ring-red-500' : ''}
                            ${isMyKingSpot ? 'ring-4 ring-inset ring-blue-500' : ''}
                            ${isHovered && canPlaceHere ? 'ring-2 ring-blue-400' : ''}
                          `}
                        >
                          {/* 자신의 킹 위치 표시 */}
                          {isMyKingSpot && !placedPiece && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                              <img
                                src={PIECE_IMAGES[myColor]['k']}
                                alt="my king"
                                className="w-10 h-10"
                              />
                            </div>
                          )}

                          {/* 상대 킹 위치 표시 */}
                          {isOppKingSpot && !placedPiece && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                              <img
                                src={PIECE_IMAGES[myColor === 'white' ? 'black' : 'white']['k']}
                                alt="opponent king"
                                className="w-10 h-10"
                              />
                            </div>
                          )}

                          {/* 호버 프리뷰: 선택된 기물을 흐리게 표시 */}
                          {isHovered && canPlaceHere && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-50 pointer-events-none">
                              <img
                                src={PIECE_IMAGES[myColor][selectedPieceType]}
                                alt="preview"
                                className="w-10 h-10"
                              />
                            </div>
                          )}

                          {/* 배치된 기물 */}
                          {placedPiece && (
                            <img
                              src={PIECE_IMAGES[myColor][placedPiece.type]}
                              alt={placedPiece.type}
                              className="w-10 h-10"
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

            {/* 하단 버튼 */}
            <button
              onClick={() => setPlacedPieces(placedPieces.filter(p => p.type === 'k'))}
              disabled={waitingForOpponent}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 uppercase tracking-widest text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>↺</span> RESET
            </button>
          </div>

          {/* 우측 컨트롤 영역 */}
          <div className="flex flex-col gap-6">
            {/* 덱 선택 */}
            <section className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Load Saved Deck</div>
              <select
                className="w-full px-4 py-2 bg-[#050505] border border-gray-800 text-white focus:outline-none focus:border-[#D4FF00] transition-colors"
                value={selectedDeckId || ''}
                onChange={(e) => {
                  const deckId = parseInt(e.target.value)
                  if (!isNaN(deckId)) {
                    handleLoadDeck(deckId)
                  }
                }}
              >
                <option value="">-- Select Deck --</option>
                {savedDecks.map(deck => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} ({deck.totalCost}pts)
                  </option>
                ))}
              </select>
              {savedDecks.length === 0 && (
                <div className="text-xs text-gray-600 mt-2">No saved decks. Create one in Deck Builder!</div>
              )}
            </section>

            {/* 보유 기물 */}
            <section className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">Available Pieces</div>
              <div className="grid grid-cols-3 gap-3">
                {availablePieces.map((piece) => {
                  const isKing = piece.type === 'k'
                  const isSelected = selectedPieceType === piece.type

                  return (
                    <div key={piece.type} className="relative">
                      <div
                        onClick={() => handlePieceSelect(piece.type)}
                        className={`
                          border bg-[#050505] p-3 text-center
                          transition-all duration-200
                          ${isKing ? 'opacity-50 cursor-not-allowed border-gray-800' : 'cursor-pointer hover:border-gray-600 border-gray-800'}
                          ${isSelected ? 'border-[#D4FF00] bg-[#D4FF00]/10' : ''}
                        `}
                      >
                        <div className="flex justify-center mb-2">
                          <img
                            src={PIECE_IMAGES[myColor][piece.type]}
                            alt={getPieceName(piece.type)}
                            className="w-10 h-10"
                            draggable={false}
                          />
                        </div>
                        <div className="text-xs font-medium mb-1 uppercase tracking-wider">{piece.type.toUpperCase()}</div>
                        <div className="text-xs text-gray-500">{piece.count} left</div>
                        <div className="text-xs text-[#D4FF00] mt-1">{PIECE_COSTS[piece.type]} pts</div>
                        {isKing && (
                          <div className="absolute top-2 right-2 h-4 w-4 grid place-items-center bg-[#D4FF00] text-black text-xs font-bold">✓</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 배치된 기물 요약 */}
            <section className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Placed Pieces</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(placedSummary).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 px-3 py-1.5 bg-[#050505] border border-gray-800">
                    <img
                      src={PIECE_IMAGES[myColor][type as PieceType]}
                      alt={type}
                      className="w-5 h-5"
                    />
                    <span className="text-xs font-mono">{type.toUpperCase()} x {count}</span>
                  </div>
                ))}
                {placedPieces.length === 0 && (
                  <div className="text-xs text-gray-600 italic">No pieces placed yet</div>
                )}
              </div>
            </section>

            {/* 사용 예산 */}
            <section className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-widest">Budget</div>
                <div className="text-lg font-mono text-[#D4FF00]">{usedBudget}<span className="text-gray-500">/30</span></div>
              </div>
              <div className="relative h-2 bg-gray-900 overflow-hidden">
                <div
                  className="absolute h-full bg-[#D4FF00] transition-all duration-300"
                  style={{ width: `${Math.min(usedBudget / 30 * 100, 100)}%` }}
                ></div>
              </div>
            </section>

            {/* 배치 확정 버튼 */}
            <button
              onClick={handleConfirmPlacement}
              disabled={!placedPieces.some(p => p.type === 'k') || waitingForOpponent}
              className={`
                flex items-center justify-center gap-2 px-6 py-4 font-bold text-sm uppercase tracking-widest
                transition-all duration-200
                ${waitingForOpponent
                  ? 'bg-gray-800 text-gray-400 cursor-wait border border-gray-700'
                  : placedPieces.some(p => p.type === 'k')
                    ? 'bg-[#D4FF00] hover:bg-white text-black cursor-pointer'
                    : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800'
                }
              `}
            >
              {waitingForOpponent ? (
                <>Waiting for opponent...</>
              ) : (
                <>CONFIRM PLACEMENT</>
              )}
            </button>
          </div>
        </div>
      </main>
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
