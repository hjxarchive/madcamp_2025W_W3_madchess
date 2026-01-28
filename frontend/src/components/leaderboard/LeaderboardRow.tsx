import React from 'react'
import RatingDisplay from '../rating/RatingDisplay'

interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  name?: string
  picture?: string
  rating: number
  rd: number
  totalGames: number
  winRate: number
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  onClick?: () => void
}

export function LeaderboardRow({ entry, onClick }: LeaderboardRowProps) {
  const isProvisional = entry.rd > 100

  return (
    <div
      className={`
        group grid grid-cols-12 py-4 border-b border-gray-800 
        hover:bg-white/5 transition-colors items-center
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {/* Rank */}
      <div className="col-span-1 flex items-center justify-center">
        <div
          className={`
            text-xl font-bold
            ${entry.rank === 1 ? 'text-[#FFD700]' : ''}
            ${entry.rank === 2 ? 'text-[#C0C0C0]' : ''}
            ${entry.rank === 3 ? 'text-[#CD7F32]' : 'text-gray-500'}
          `}
        >
          #{entry.rank}
        </div>
      </div>

      {/* Player Info */}
      <div className="col-span-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
          <img
            src={
              entry.picture ||
              `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(
                entry.name || entry.username
              )}`
            }
            alt={entry.name || entry.username}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <div className="font-bold text-lg">{entry.name || entry.username}</div>
          <div className="text-xs text-gray-500">@{entry.username}</div>
        </div>
      </div>

      {/* Rating */}
      <div className="col-span-3">
        <RatingDisplay
          rating={entry.rating}
          rd={entry.rd}
          variant="compact"
          showProvisional={true}
          provisionalThreshold={100}
        />
      </div>

      {/* Stats */}
      <div className="col-span-2 text-center">
        <div className="text-sm text-gray-400">
          {entry.totalGames} games
        </div>
        <div className="text-sm text-[#D4FF00]">
          {Math.round(entry.winRate * 100)}% WR
        </div>
      </div>

      {/* Action Arrow */}
      <div className="col-span-1 flex justify-end">
        {onClick && (
          <span className="text-gray-600 group-hover:text-[#D4FF00] transition-colors">
            →
          </span>
        )}
      </div>
    </div>
  )
}
