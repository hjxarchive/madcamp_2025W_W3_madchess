import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LeaderboardRow } from '../components/leaderboard/LeaderboardRow'

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

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'established'>('all')

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      // TODO: API 엔드포인트 구현 필요
      const response = await fetch('/api/leaderboard')
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard')
      }

      const data = await response.json()
      setLeaderboard(data.data || [])
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
      setError('Failed to load leaderboard')
      
      // Mock data for development
      const mockData: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: 1,
          username: 'grandmaster',
          name: 'John Doe',
          rating: 2100,
          rd: 45,
          totalGames: 150,
          winRate: 0.68,
        },
        {
          rank: 2,
          userId: 2,
          username: 'chessmaster',
          name: 'Jane Smith',
          rating: 2050,
          rd: 60,
          totalGames: 120,
          winRate: 0.65,
        },
        {
          rank: 3,
          userId: 3,
          username: 'rookie',
          name: 'Bob Wilson',
          rating: 1980,
          rd: 150,
          totalGames: 20,
          winRate: 0.60,
        },
      ]
      setLeaderboard(mockData)
    } finally {
      setLoading(false)
    }
  }

  const filteredLeaderboard =
    filter === 'established'
      ? leaderboard.filter((entry) => entry.rd <= 100)
      : leaderboard

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#050505]/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <span className="text-xl group-hover:-translate-x-1 transition-transform">
              ←
            </span>
            <span className="uppercase tracking-widest text-xs font-bold">
              Back to Arena
            </span>
          </button>
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            <div className="w-6 h-6 bg-white skew-x-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-80"></div>
            </div>
            <div className="font-serif text-lg">
              <span className="text-[#D4FF00]">MAD</span>
              <span className="text-white">CHESS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Title */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-serif font-light mb-4">
            <span className="text-white">LEADER</span>
            <span className="text-[#D4FF00]">BOARD</span>
          </h1>
          <p className="text-gray-500 uppercase tracking-widest text-sm">
            Top Players by Rating
          </p>
        </div>

        {/* Filter */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex border border-gray-800 rounded overflow-hidden">
            <button
              onClick={() => setFilter('all')}
              className={`
                px-6 py-2 text-sm font-bold uppercase tracking-widest transition-colors
                ${
                  filter === 'all'
                    ? 'bg-[#D4FF00] text-black'
                    : 'bg-transparent text-gray-400 hover:text-white'
                }
              `}
            >
              All Players
            </button>
            <button
              onClick={() => setFilter('established')}
              className={`
                px-6 py-2 text-sm font-bold uppercase tracking-widest transition-colors border-l border-gray-800
                ${
                  filter === 'established'
                    ? 'bg-[#D4FF00] text-black'
                    : 'bg-transparent text-gray-400 hover:text-white'
                }
              `}
            >
              Established Only
            </button>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="border border-gray-800 bg-[#0A0A0A]">
          {/* Table Header */}
          <div className="grid grid-cols-12 py-4 px-4 border-b border-gray-800 bg-[#050505] uppercase tracking-widest text-xs font-bold text-gray-500">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-3">Rating</div>
            <div className="col-span-2 text-center">Stats</div>
            <div className="col-span-1"></div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="py-24 text-center text-gray-500">
              <div className="animate-pulse text-4xl mb-4">⏳</div>
              <div className="uppercase tracking-widest text-sm">Loading...</div>
            </div>
          ) : error ? (
            <div className="py-24 text-center text-red-500">
              <div className="text-4xl mb-4">⚠️</div>
              <div className="uppercase tracking-widest text-sm">{error}</div>
              <button
                onClick={fetchLeaderboard}
                className="mt-4 px-6 py-2 border border-gray-800 hover:border-[#D4FF00] text-gray-400 hover:text-white uppercase tracking-widest text-xs font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="py-24 text-center text-gray-600">
              <div className="text-4xl mb-4">🏆</div>
              <div className="uppercase tracking-widest text-sm">
                No Players Found
              </div>
            </div>
          ) : (
            filteredLeaderboard.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                onClick={() => {
                  // TODO: 프로필 페이지로 이동 또는 상세 정보 표시
                  console.log('View player:', entry.userId)
                }}
              />
            ))
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 uppercase tracking-wider">
          <p>Players with RD &gt; 100 are marked as "잠정"</p>
          <p className="mt-2">
            Rating Deviation (RD) indicates confidence in the rating
          </p>
        </div>
      </main>
    </div>
  )
}
