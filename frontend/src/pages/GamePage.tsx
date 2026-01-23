import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import ChessBoard from '../components/ChessBoard'
import PlayerInfo from '../components/PlayerInfo'
import { Move, Piece } from '../types/game'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { gameState, makeMove } = useGameStore()
  const [useImages, setUseImages] = useState(false)  // 기물 이미지 사용 여부

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

  // 임시로 백 플레이어로 설정
  const myColor = gameState.white.color
  const isMyTurn = gameState.currentTurn === myColor

  const opponent = myColor === 'white' ? gameState.black : gameState.white
  const me = myColor === 'white' ? gameState.white : gameState.black

  const handleMove = (move: Move) => {
    makeMove(move)
    // TODO: Socket.io를 통해 서버로 이동 전송
    console.log('Move made:', move)
  }

  // 백엔드 연동 시 fetchLegalMoves를 교체하세요.
  // 임시 목업: 기본 체스 폰과 나이트 이동만 단순 계산
  const fetchLegalMovesMock = async ({ row, col, piece }: { row: number; col: number; piece: Piece }) => {
    const moves: { row: number; col: number }[] = []
    const forward = piece.color === 'white' ? -1 : 1 // 현재 배열 기준으로 white는 row 감소(아래 → 위), black은 증가

    if (piece.type === 'p') {
      const one = row + forward
      const two = row + forward * 2
      if (one >= 0 && one < 8) moves.push({ row: one, col })
      // 첫 수 더블 무브
      const startRank = piece.color === 'white' ? 6 : 1
      if (row === startRank && two >= 0 && two < 8) moves.push({ row: two, col })
    }

    if (piece.type === 'n') {
      const deltas = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      deltas.forEach(([dr, dc]) => {
        const r = row + dr
        const c = col + dc
        if (r >= 0 && r < 8 && c >= 0 && c < 8) moves.push({ row: r, col: c })
      })
    }

    // TODO: 백엔드 응답으로 교체
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
                    <span className={`font-semibold ${
                      gameState.isCheck ? 'text-red-500' : 'text-green-500'
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
                      <span className="text-sm">백 (당신)</span>
                      <span className="font-semibold">
                        {39 - gameState.capturedPieces.white.reduce((sum, p) => {
                          const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
                          return sum + vals[p]
                        }, 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">흑 (상대)</span>
                      <span className="font-semibold">
                        {39 - gameState.capturedPieces.black.reduce((sum, p) => {
                          const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
                          return sum + vals[p]
                        }, 0)}
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
