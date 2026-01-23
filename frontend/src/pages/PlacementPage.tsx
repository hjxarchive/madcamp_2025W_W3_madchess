import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PieceType, PieceColor, PIECE_COSTS, PIECE_MAX_COUNT, PlacedPiece } from '../types/game'

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

export default function PlacementPage() {
  const navigate = useNavigate()
  const { gameId } = useParams<{ gameId: string }>()
  
  const [myColor, setMyColor] = useState<PieceColor>('white')
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([])
  const [draggedPiece, setDraggedPiece] = useState<{ type: PieceType; index: number } | null>(null)
  const [usedBudget, setUsedBudget] = useState(0)

  // 초기화: sessionStorage에서 색상 정보 읽기 및 킹 자동 배치
  useEffect(() => {
    const savedColor = sessionStorage.getItem('selectedColor') as PieceColor | null
    if (savedColor) {
      setMyColor(savedColor)
      sessionStorage.removeItem('selectedColor')
      
      // 킹을 자동으로 배치
      const kingRow = savedColor === 'white' ? 7 : 0
      const kingCol = 4
      setPlacedPieces([{ type: 'k', row: kingRow, col: kingCol }])
    }
  }, [])

  // 배치 가능한 구역 (8*4) - white: 4~7행, black: 0~3행
  const placementRows = myColor === 'white' ? [4, 5, 6, 7] : [0, 1, 2, 3]
  const isPlacementArea = (row: number) => placementRows.includes(row)

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
  const handleDrop = (row: number, col: number, e: React.DragEvent) => {
    e.preventDefault()

    if (!draggedPiece) return

    // 배치 가능 구역 확인
    if (!isPlacementArea(row)) {
      alert('자신의 진영에만 배치할 수 있습니다')
      return
    }

    // 킹 위치 체크
    const myKingRow = myColor === 'white' ? 7 : 0
    const kingCol = 4 // e열
    const isKingPosition = row === myKingRow && col === kingCol

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
      prev.filter(p => !(p.row === row && p.col === col))
    )

    // 새 기물 배치
    const newPiece: PlacedPiece = {
      type: draggedPiece.type,
      row,
      col,
    }

    setPlacedPieces(prev => [...prev, newPiece])
    setDraggedPiece(null)
  }

  // 보드 칸 클릭해서 기물 제거
  const handleSquareClick = (row: number, col: number) => {
    const clickedPiece = placedPieces.find(p => p.row === row && p.col === col)
    
    // 킹은 제거할 수 없음
    if (clickedPiece?.type === 'k') {
      alert('킹은 제거할 수 없습니다')
      return
    }
    
    setPlacedPieces(prev =>
      prev.filter(p => !(p.row === row && p.col === col))
    )
  }

  // 배치 완료
  const handleConfirmPlacement = () => {
    // 킹이 배치되었는지 확인
    const kingPlaced = placedPieces.some(p => p.type === 'k')
    if (!kingPlaced) {
      alert('킹을 배치해야 합니다')
      return
    }

    // 더미 상대 배치 생성 (백엔드에서 나중에 받아올 예정)
    const opponentColor = myColor === 'white' ? 'black' : 'white'
    const dummyOpponentPlacement: PlacedPiece[] = [
      { type: 'k', row: opponentColor === 'white' ? 7 : 0, col: 4 }, // 킹
      { type: 'r', row: opponentColor === 'white' ? 7 : 0, col: 0 },
      { type: 'r', row: opponentColor === 'white' ? 7 : 0, col: 7 },
      { type: 'n', row: opponentColor === 'white' ? 7 : 0, col: 1 },
      { type: 'n', row: opponentColor === 'white' ? 7 : 0, col: 6 },
      { type: 'b', row: opponentColor === 'white' ? 7 : 0, col: 2 },
      { type: 'b', row: opponentColor === 'white' ? 7 : 0, col: 5 },
      { type: 'q', row: opponentColor === 'white' ? 7 : 0, col: 3 },
      ...Array.from({ length: 8 }).map((_, i) => ({
        type: 'p' as PieceType,
        row: opponentColor === 'white' ? 6 : 1,
        col: i,
      })),
    ]

    // sessionStorage에 배치 정보 저장
    sessionStorage.setItem('placedPieces', JSON.stringify(placedPieces))
    sessionStorage.setItem('myColor', myColor)
    sessionStorage.setItem('opponentPlacement', JSON.stringify(dummyOpponentPlacement))
    
    navigate(`/game/${gameId}`)
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
              {Array.from({ length: 8 }).map((_, rowIdx) => {
                const row = myColor === 'black' ? 7 - rowIdx : rowIdx
                const isPlacementRow = isPlacementArea(row)
                
                return (
                  <div key={row} className="flex">
                    {Array.from({ length: 8 }).map((_, colIdx) => {
                      const col = myColor === 'black' ? 7 - colIdx : colIdx
                      const isLight = (row + col) % 2 === 0
                      const placedPiece = placedPieces.find(p => p.row === row && p.col === col)
                      const isMyKingSpot = row === (myColor === 'white' ? 7 : 0) && col === 4
                      const isOppKingSpot = row === (myColor === 'white' ? 0 : 7) && col === 4

                      return (
                        <div
                          key={`${row}-${col}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(row, col, e)}
                          onClick={() => placedPiece && handleSquareClick(row, col)}
                          className={`
                            w-16 h-16 flex items-center justify-center cursor-move relative
                            transition-all duration-200
                            ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                            ${!isPlacementRow ? 'opacity-30' : ''}
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
                disabled={!placedPieces.some(p => p.type === 'k')}
                className={`
                  w-full py-2 rounded-lg font-semibold transition-colors
                  ${placedPieces.some(p => p.type === 'k')
                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                배치 완료
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold transition-colors"
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
