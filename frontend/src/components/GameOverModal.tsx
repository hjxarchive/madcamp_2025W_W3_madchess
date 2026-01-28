import React, { useEffect, useState } from 'react'
import { RatingChange } from './rating/RatingDisplay'

interface RatingInfo {
  oldRating: number
  newRating: number
  ratingDelta: number
  oldRd: number
  newRd: number
  pieceScore: number
  handicapApplied: boolean
}

interface GameOverModalProps {
  isOpen: boolean
  winner: 'white' | 'black' | 'draw' | null
  reason?: string
  ratingChanges?: {
    white: RatingInfo
    black: RatingInfo
  }
  playerColor?: 'white' | 'black'
  onClose: () => void
  onRematch?: () => void
  onBackToHome?: () => void
}

export default function GameOverModal({
  isOpen,
  winner,
  reason,
  ratingChanges,
  playerColor,
  onClose,
  onRematch,
  onBackToHome,
}: GameOverModalProps) {
  const [showRating, setShowRating] = useState(false)

  useEffect(() => {
    if (isOpen && ratingChanges) {
      // 모달이 열리고 0.5초 후에 레이팅 애니메이션 시작
      const timer = setTimeout(() => setShowRating(true), 500)
      return () => clearTimeout(timer)
    } else {
      setShowRating(false)
    }
  }, [isOpen, ratingChanges])

  if (!isOpen) return null

  const getResultText = () => {
    if (winner === 'draw') return '무승부'
    if (playerColor === winner) return '승리!'
    return '패배'
  }

  const getResultColor = () => {
    if (winner === 'draw') return 'text-gray-300'
    if (playerColor === winner) return 'text-[#D4FF00]'
    return 'text-red-400'
  }

  const myRating = playerColor && ratingChanges ? ratingChanges[playerColor] : null
  const opponentColor = playerColor === 'white' ? 'black' : 'white'
  const opponentRating = playerColor && ratingChanges ? ratingChanges[opponentColor] : null

  const getHandicapText = (ratingInfo: RatingInfo) => {
    if (!ratingInfo.handicapApplied) return null
    
    const handicapEffect = Math.abs(ratingInfo.ratingDelta - ratingInfo.ratingDelta)
    // 실제 핸디캡 효과는 서버에서 계산되므로, 여기서는 기물 점수 차이만 표시
    const pieceScoreDiff = Math.abs(
      myRating!.pieceScore - opponentRating!.pieceScore
    )
    
    return `기물 점수 차이로 인한 보정 (${pieceScoreDiff}점 차이)`
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* 게임 결과 */}
        <div className="text-center mb-6">
          <h2 className={`text-4xl font-bold mb-2 ${getResultColor()}`}>
            {getResultText()}
          </h2>
          {reason && (
            <p className="text-gray-400 text-sm">
              {reason === 'checkmate' && '체크메이트'}
              {reason === 'resignation' && '상대방이 기권했습니다'}
              {reason === 'timeout' && '시간 초과'}
              {reason === 'mutual agreement' && '합의 무승부'}
              {reason === 'stalemate' && '스테일메이트'}
              {reason === 'insufficient material' && '기물 부족'}
              {reason === 'threefold repetition' && '3회 동형 반복'}
              {reason === '50-move rule' && '50수 규칙'}
            </p>
          )}
        </div>

        {/* 레이팅 변화 */}
        {ratingChanges && myRating && showRating && (
          <div className="space-y-4 mb-6">
            <div className="border border-gray-700 rounded-lg p-4 bg-[#0A0A0A]">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                내 레이팅
              </div>
              <RatingChange
                oldRating={myRating.oldRating}
                newRating={myRating.newRating}
                ratingDelta={myRating.ratingDelta}
                animated={true}
                showOldRating={true}
              />
              <div className="mt-2 text-xs text-gray-500">
                RD: {Math.round(myRating.oldRd)} → {Math.round(myRating.newRd)}
              </div>
              {myRating.handicapApplied && (
                <div className="mt-2 flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
                  <span className="text-yellow-400">ⓘ</span>
                  <span>{getHandicapText(myRating)}</span>
                </div>
              )}
            </div>

            {opponentRating && (
              <div className="border border-gray-700 rounded-lg p-4 bg-[#0A0A0A]">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                  상대방 레이팅
                </div>
                <RatingChange
                  oldRating={opponentRating.oldRating}
                  newRating={opponentRating.newRating}
                  ratingDelta={opponentRating.ratingDelta}
                  animated={true}
                  showOldRating={false}
                />
                <div className="mt-2 text-xs text-gray-500">
                  RD: {Math.round(opponentRating.oldRd)} → {Math.round(opponentRating.newRd)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          {onRematch && (
            <button
              onClick={onRematch}
              className="flex-1 bg-[#D4FF00] text-black font-bold py-3 rounded hover:bg-[#C4EF00] transition-colors"
            >
              재대결
            </button>
          )}
          <button
            onClick={onBackToHome || onClose}
            className="flex-1 bg-gray-800 text-white font-bold py-3 rounded hover:bg-gray-700 transition-colors"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}
