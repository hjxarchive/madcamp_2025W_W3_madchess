import React from 'react'

interface RatingDisplayProps {
  rating: number
  rd: number
  variant?: 'default' | 'compact' | 'detailed'
  showProvisional?: boolean
  provisionalThreshold?: number
}

/**
 * Glicko-2 레이팅을 표시하는 컴포넌트
 * - rating: 현재 레이팅
 * - rd: Rating Deviation (신뢰도)
 * - variant: 표시 스타일 (default, compact, detailed)
 * - showProvisional: RD가 높을 때 "잠정" 표시 여부
 * - provisionalThreshold: 잠정 판단 기준 RD 값 (기본 100)
 */
export default function RatingDisplay({
  rating,
  rd,
  variant = 'default',
  showProvisional = false,
  provisionalThreshold = 100,
}: RatingDisplayProps) {
  const isProvisional = rd > provisionalThreshold

  // 95% 신뢰구간: rating ± 1.96 * rd
  const confidenceMargin = Math.round(1.96 * rd)
  const lowerBound = Math.round(rating - confidenceMargin)
  const upperBound = Math.round(rating + confidenceMargin)

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="font-bold text-[#D4FF00]">{Math.round(rating)}</span>
        {showProvisional && isProvisional && (
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">(잠정)</span>
        )}
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#D4FF00]">{Math.round(rating)}</span>
          {showProvisional && isProvisional && (
            <span className="text-xs text-gray-400 uppercase tracking-wider">(잠정)</span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          신뢰구간: {lowerBound} ~ {upperBound}
          <span className="text-xs text-gray-500 ml-2">(±{confidenceMargin})</span>
        </div>
        <div className="text-xs text-gray-500">
          RD: {Math.round(rd)} {isProvisional && '(높은 불확실성)'}
        </div>
      </div>
    )
  }

  // default variant
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xl font-bold text-[#D4FF00]">{Math.round(rating)}</span>
      <span className="text-sm text-gray-400">± {confidenceMargin}</span>
      {showProvisional && isProvisional && (
        <span className="text-xs text-gray-400 uppercase tracking-wider">(잠정)</span>
      )}
    </div>
  )
}

/**
 * 레이팅 범위를 표시하는 컴포넌트 (매치메이킹용)
 */
export function RatingRange({
  minRating,
  maxRating,
  className = '',
}: {
  minRating: number
  maxRating: number
  className?: string
}) {
  return (
    <div className={`inline-flex items-center gap-1 text-gray-300 ${className}`}>
      <span className="font-semibold">{Math.round(minRating)}</span>
      <span className="text-gray-500">~</span>
      <span className="font-semibold">{Math.round(maxRating)}</span>
    </div>
  )
}

/**
 * 레이팅 변화를 애니메이션으로 표시하는 컴포넌트
 */
export function RatingChange({
  oldRating,
  newRating,
  ratingDelta,
  animated = true,
  showOldRating = true,
}: {
  oldRating: number
  newRating: number
  ratingDelta: number
  animated?: boolean
  showOldRating?: boolean
}) {
  const isPositive = ratingDelta >= 0
  const deltaColor = isPositive ? 'text-green-400' : 'text-red-400'
  const deltaSign = isPositive ? '+' : ''

  return (
    <div className="flex items-center gap-2">
      {showOldRating && (
        <span className="text-gray-500 line-through">{Math.round(oldRating)}</span>
      )}
      <span
        className={`text-2xl font-bold text-[#D4FF00] ${
          animated ? 'transition-all duration-500 ease-out' : ''
        }`}
      >
        {Math.round(newRating)}
      </span>
      <span className={`text-lg font-semibold ${deltaColor}`}>
        ({deltaSign}
        {Math.round(ratingDelta)})
      </span>
    </div>
  )
}
