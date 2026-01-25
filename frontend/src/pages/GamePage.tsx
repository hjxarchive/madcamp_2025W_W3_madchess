import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import ChessBoard from '../components/ChessBoard'
import PlayerInfo from '../components/PlayerInfo'
import { Move, Piece, PlacedPiece, PieceColor, squareToRowCol } from '../types/game'
import { socketService } from '../services/socket'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { gameState, setGameState, makeMove, applyOpponentMove, rollbackMove } = useGameStore()
  const [useImages, setUseImages] = useState(true)
  const [myColor, setMyColor] = useState<PieceColor>('white')
  const [isCheck, setIsCheck] = useState(false)
  const [isCheckmate, setIsCheckmate] = useState(false)
  const [gameOverData, setGameOverData] = useState<{ winner: string; reason: string } | null>(null)
  const [showPromotion, setShowPromotion] = useState(false)
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  // 개발 모드에서 전역 접근을 위해 window에 노출
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).testMove = (uci: string, piece: string, captured?: string) => {
        applyOpponentMove({ uci, piece: piece as any, captured: captured as any })
      }
      console.log('🎮 테스트 함수 사용 가능: testMove("e2e4", "p")')
    }
    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).testMove
      }
    }
  }, [applyOpponentMove])

  // sessionStorage에서 배치 정보 로드
  useEffect(() => {
    const savedColor = sessionStorage.getItem('myColor') as PieceColor | null
    if (savedColor) {
      setMyColor(savedColor)
    }

    // 배치 정보가 있으면 보드 초기화
    const placedPiecesStr = sessionStorage.getItem('placedPieces')
    if (placedPiecesStr) {
      const placedPieces = JSON.parse(placedPiecesStr) as PlacedPiece[]

      // 보드에 배치된 기물 배치
      const newBoard = Array(8).fill(null).map(() => Array(8).fill(null))

      // 내 기물 배치
      placedPieces.forEach((piece) => {
        const { row, col } = squareToRowCol({ file: piece.file, rank: piece.rank })
        newBoard[row][col] = {
          type: piece.type,
          color: savedColor || myColor,
        }
      })

      // 상대 기물 배치
      const opponentPlacementStr = sessionStorage.getItem('opponentPlacement')
      if (opponentPlacementStr) {
        const opponentPlacement = JSON.parse(opponentPlacementStr) as PlacedPiece[]
        const opponentColor = (savedColor || myColor) === 'white' ? 'black' : 'white'

        opponentPlacement.forEach((piece) => {
          const { row, col } = squareToRowCol({ file: piece.file, rank: piece.rank })
          newBoard[row][col] = {
            type: piece.type,
            color: opponentColor,
          }
        })
      }

      // gameStore 업데이트

      setGameState({
        roomId: gameId || 'test-room',
        white: {
          userId: 'white-player',
          username: 'White Player',
          rating: 1500,
          deckId: 'deck-1',
          color: 'white',
        },
        black: {
          userId: 'black-player',
          username: 'Black Player',
          rating: 1500,
          deckId: 'deck-2',
          color: 'black',
        },
        board: newBoard,
        currentTurn: 'white',
        moveCount: 0,
        pgn: '',
        status: 'playing',
        isCheck: false,
        capturedPieces: {
          white: [],
          black: [],
        },
      })

      console.log('Loaded board:', newBoard)
      console.log('My color:', savedColor || myColor)

      // 사용한 데이터는 제거 (한 번만 사용)
      sessionStorage.removeItem('placedPieces')
      sessionStorage.removeItem('opponentPlacement')
      sessionStorage.removeItem('myColor')
    }
  }, [])

  // WebSocket 이벤트 리스너 설정
  useEffect(() => {
    // 서버에서 브로드캐스트된 수를 받았을 때
    socketService.onMoveMade((data) => {
      console.log('Received move-made from server:', data)

      // Update check status
      setIsCheck(data.isCheck || false)
      setIsCheckmate(data.isCheckmate || false)

      // 내가 보낸 수가 아닌 경우에만 적용
      const mySocketId = socketService.getSocket()?.id
      const isMyMove = data.socketId ? data.socketId === mySocketId : data.move.playerId === mySocketId
      if (!isMyMove) {
        applyOpponentMove(data.move)
      }
    })

    // Game over event
    socketService.onGameOver((data) => {
      console.log('Game over:', data)
      setGameOverData(data)
      setIsCheckmate(data.reason === 'checkmate')
    })

    // 이동 에러
    socketService.onMoveError((data) => {
      console.error('Move error:', data.message)

      // Rollback the move
      rollbackMove()

      // Show error message
      setMoveError(data.message)
      // 3초 후 에러 메시지 자동 숨김
      setTimeout(() => setMoveError(null), 3000)
    })

    // 정리
    return () => {
      socketService.offMoveMade()
      socketService.offGameOver()
      socketService.offMoveError()
    }
  }, [applyOpponentMove])

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">게임을 불러오는 중...</div>
          <div className="text-gray-400">Game ID: {gameId}</div>
        </div>
      </div>
    )
  }

  // myColor를 사용하여 설정
  const isMyTurn = gameState.currentTurn === myColor

  const opponent = myColor === 'white' ? gameState.black : gameState.white
  const me = myColor === 'white' ? gameState.white : gameState.black

  const handleMove = (move: Move) => {
    // Prevent moves if game is over
    if (gameOverData || gameState?.status !== 'playing') {
      console.log('Game is over, move prevented')
      return
    }

    makeMove(move)
    // Socket.io를 통해 서버로 이동 전송
    if (gameState) {
      socketService.sendMove(gameState.roomId, move)
      console.log('Move sent to server:', move)
    }
  }

  // 백엔드 연동 시 fetchLegalMoves를 교체하세요.
  // 모든 기물의 합법적 수를 계산하는 함수
  const fetchLegalMovesMock = async ({ row, col, piece }: { row: number; col: number; piece: Piece }) => {
    const moves: { row: number; col: number }[] = []
    const forward = piece.color === 'white' ? -1 : 1

    // 도움 함수: 직선 이동 (룩, 비숍, 퀸용)
    const addLineMoves = (directions: [number, number][]) => {
      directions.forEach(([dr, dc]) => {
        let r = row + dr
        let c = col + dc
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = gameState.board[r][c]
          if (!target) {
            // 빈 칸이면 추가
            moves.push({ row: r, col: c })
          } else if (target.color !== piece.color) {
            // 상대 기물이면 추가하고 중단
            moves.push({ row: r, col: c })
            break
          } else {
            // 자신의 기물이면 중단
            break
          }
          r += dr
          c += dc
        }
      })
    }

    if (piece.type === 'p') {
      // 폰: 전진 1칸 또는 2칸 (빈 칸만), 대각선 캡처
      const one = row + forward
      const two = row + forward * 2

      // 전진
      if (one >= 0 && one < 8 && !gameState.board[one][col]) {
        moves.push({ row: one, col })

        // 첫 수 더블 무브
        const startRank = piece.color === 'white' ? 6 : 1
        if (row === startRank && !gameState.board[two][col]) {
          moves.push({ row: two, col })
        }
      }

      // 대각선 캡처
      if (one >= 0 && one < 8) {
        for (const dc of [-1, 1]) {
          const nc = col + dc
          if (nc >= 0 && nc < 8) {
            const target = gameState.board[one][nc]
            if (target && target.color !== piece.color) {
              moves.push({ row: one, col: nc })
            }
          }
        }
      }
    } else if (piece.type === 'n') {
      // 나이트: 8가지 L자 이동
      const deltas = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      deltas.forEach(([dr, dc]) => {
        const r = row + dr
        const c = col + dc
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = gameState.board[r][c]
          if (!target || target.color !== piece.color) {
            moves.push({ row: r, col: c })
          }
        }
      })
    } else if (piece.type === 'b') {
      // 비숍: 4대각선 방향
      addLineMoves([
        [-1, -1], [-1, 1], [1, -1], [1, 1],
      ])
    } else if (piece.type === 'r') {
      // 룩: 4수평/수직 방향
      addLineMoves([
        [-1, 0], [1, 0], [0, -1], [0, 1],
      ])
    } else if (piece.type === 'q') {
      // 퀸: 8방향 (룩 + 비숍)
      addLineMoves([
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
      ])
    } else if (piece.type === 'k') {
      // 킹: 한 칸씩 8방향
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const r = row + dr
          const c = col + dc
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const target = gameState.board[r][c]
            if (!target || target.color !== piece.color) {
              moves.push({ row: r, col: c })
            }
          }
        }
      }
    }

    return moves
  }

  const handleResign = () => {
    if (confirm('정말 항복하시겠습니까?')) {
      // TODO: 항복 처리
      console.log('Player resigned')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      {/* CHECK! Notification */}
      {isCheck && !isCheckmate && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-8 py-3 rounded-lg shadow-2xl animate-bounce font-bold text-xl">
          ⚠️ CHECK!
        </div>
      )}

      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              {gameOverData.reason === 'checkmate' ? '👑 Checkmate!' : '🤝 Game Over'}
            </h2>
            <p className="text-xl mb-6">
              {gameOverData.winner === 'draw'
                ? `Game ended in ${gameOverData.reason}`
                : `Winner: ${gameOverData.winner === myColor ? 'You!' : 'Opponent'}`
              }
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">덱 체스</h1>
            <div className="text-gray-400 text-sm">Game ID: {gameId}</div>
          </div>

          {/* 게임 컨트롤 */}
          <div className="flex gap-3">
            <button
              onClick={() => setUseImages(!useImages)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              title="기물 스타일 전환"
            >
              {useImages ? '🔤 텍스트' : '🖼️ 이미지'}
            </button>
            <button
              onClick={handleResign}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
            >
              항복
            </button>
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              무승부 제안
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-6">
          {/* 왼쪽: 이동 기록 */}
          <div className="order-2 xl:order-1">
            <div className="bg-gray-800 rounded-lg p-4 h-full">
              <h2 className="text-xl font-bold mb-4">이동 기록</h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {gameState.pgn ? (
                  <div className="text-sm font-mono whitespace-pre-wrap">
                    {gameState.pgn}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    아직 이동이 없습니다
                  </div>
                )}
              </div>

              {/* 게임 정보 */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">수 번호:</span>
                    <span className="font-semibold">{Math.floor(gameState.moveCount / 2) + 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">상태:</span>
                    <span className={`font-semibold ${gameState.isCheck ? 'text-red-500' : 'text-green-500'
                      }`}>
                      {gameState.isCheck ? '체크!' : '정상'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">게임 상태:</span>
                    <span className="font-semibold capitalize">{gameState.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 중앙: 체스보드 */}
          <div className="order-1 xl:order-2">
            <div className="bg-gray-800 rounded-lg p-6">
              {/* 상대 정보 */}
              <PlayerInfo
                player={opponent}
                isCurrentTurn={gameState.currentTurn === opponent.color}
                capturedPieces={gameState.capturedPieces[myColor]}
                isOpponent={true}
              />

              {/* 체스보드 */}
              <div className="my-6">
                <ChessBoard
                  board={gameState.board}
                  currentTurn={gameState.currentTurn}
                  myColor={myColor}
                  isMyTurn={isMyTurn}
                  lastMove={gameState.lastMove}
                  isCheck={gameState.isCheck}
                  onMove={handleMove}
                  useImages={useImages}
                  fetchLegalMoves={fetchLegalMovesMock}
                />
              </div>

              {/* 내 정보 */}
              <PlayerInfo
                player={me}
                isCurrentTurn={gameState.currentTurn === myColor}
                capturedPieces={gameState.capturedPieces[opponent.color]}
                isOpponent={false}
              />
            </div>
          </div>

          {/* 오른쪽: 채팅/통계 (추후 구현) */}
          <div className="order-3 xl:order-3">
            <div className="bg-gray-800 rounded-lg p-4 h-full">
              <h2 className="text-xl font-bold mb-4">게임 통계</h2>

              <div className="space-y-4">
                {/* 머티리얼 카운트 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">기물 가치</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{myColor === 'white' ? '백 (당신)' : '흑 (당신)'}</span>
                      <span className="font-semibold">
                        {(() => {
                          const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
                          let total = 0
                          gameState.board.forEach(row => {
                            row.forEach(piece => {
                              if (piece && piece.color === myColor) {
                                total += vals[piece.type]
                              }
                            })
                          })
                          return total
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{myColor === 'white' ? '흑 (상대)' : '백 (상대)'}</span>
                      <span className="font-semibold">
                        {(() => {
                          const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
                          const opponentColor = myColor === 'white' ? 'black' : 'white'
                          let total = 0
                          gameState.board.forEach(row => {
                            row.forEach(piece => {
                              if (piece && piece.color === opponentColor) {
                                total += vals[piece.type]
                              }
                            })
                          })
                          return total
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 덱 정보 */}
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">사용 덱</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-gray-400">내 덱:</div>
                      <div className="font-semibold">{me.deckId}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">상대 덱:</div>
                      <div className="font-semibold">{opponent.deckId}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
