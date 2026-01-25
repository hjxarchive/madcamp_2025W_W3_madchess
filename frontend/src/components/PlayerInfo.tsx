import { PlayerInfo as PlayerInfoType, PieceType } from '../types/game'

interface PlayerInfoProps {
  player: PlayerInfoType
  isCurrentTurn: boolean
  capturedPieces: PieceType[]
  isOpponent?: boolean
}

// 기물별 점수
const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

// 기물 심볼 (간단 버전)
const PIECE_SYMBOLS: Record<PieceType, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}

export default function PlayerInfo({
  player,
  isCurrentTurn,
  capturedPieces,
  isOpponent = false,
}: PlayerInfoProps) {
  // 잡은 기물의 총 가치 계산
  const materialAdvantage = capturedPieces.reduce(
    (sum, piece) => sum + PIECE_VALUES[piece],
    0
  )

  // 잡은 기물을 종류별로 그룹화
  const groupedPieces = capturedPieces.reduce((acc, piece) => {
    acc[piece] = (acc[piece] || 0) + 1
    return acc
  }, {} as Record<PieceType, number>)

  return (
    <div
      className={`
        p-4 rounded-lg transition-all duration-300
        ${isCurrentTurn ? 'bg-green-900 ring-2 ring-green-500' : 'bg-gray-800'}
        ${isOpponent ? 'mb-4' : 'mt-4'}
      `}
    >
      {/* 플레이어 정보 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* 아바타 */}
          <div
            className={`
              w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl
              ${player.color === 'white' ? 'bg-amber-100 text-gray-900' : 'bg-gray-900 text-amber-100'}
            `}
          >
            {player.username.charAt(0).toUpperCase()}
          </div>

          {/* 이름 및 레이팅 */}
          <div>
            <div className="font-semibold text-lg">{player.username}</div>
            <div className="text-sm text-gray-400">레이팅: {player.rating}</div>
          </div>
        </div>

        {/* 색상 표시 */}
        <div
          className={`
            px-3 py-1 rounded text-sm font-semibold
            ${player.color === 'white' ? 'bg-amber-100 text-gray-900' : 'bg-gray-900 text-amber-100'}
          `}
        >
          {player.color === 'white' ? '백' : '흑'}
        </div>
      </div>

      {/* 턴 인디케이터 */}
      {isCurrentTurn && (
        <div className="mb-3 flex items-center gap-2 text-green-400 text-sm font-semibold">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>차례입니다</span>
        </div>
      )}

      {/* 잡은 기물 */}
      {capturedPieces.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">잡은 기물</div>
          <div className="flex flex-wrap gap-1 items-center">
            {Object.entries(groupedPieces)
              .sort(([a], [b]) => PIECE_VALUES[b as PieceType] - PIECE_VALUES[a as PieceType])
              .map(([piece, count]) => (
                <div
                  key={piece}
                  className="flex items-center bg-gray-700 rounded px-2 py-1"
                >
                  <span className="text-2xl">{PIECE_SYMBOLS[piece as PieceType]}</span>
                  {count > 1 && (
                    <span className="text-xs ml-1 text-gray-400">×{count}</span>
                  )}
                </div>
              ))}

            {/* 총 가치 */}
            <div className="ml-2 text-sm font-semibold text-green-400">
              +{materialAdvantage}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
