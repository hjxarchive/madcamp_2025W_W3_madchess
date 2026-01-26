import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserById, getUserGames } from '../services/userApi'
import type { ApiResponse, User, UserGame } from '../types/api.types'

export default function HomePage() {
  const navigate = useNavigate()

  // Dummy data fallback
  const dummyUser: User = {
    id: 1,
    username: 'player123',
    rating: 1550,
    createdAt: new Date().toISOString(),
  }

  const dummyGames: UserGame[] = [
    { gameId: 101, opponent: 'opponentA', result: 'WIN', ratingChange: 15, playedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
    { gameId: 100, opponent: 'opponentB', result: 'LOSE', ratingChange: -12, playedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    { gameId: 99, opponent: 'opponentC', result: 'DRAW', ratingChange: 0, playedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  ]

  const [user, setUser] = useState<User>(dummyUser)
  const [recentGames, setRecentGames] = useState<UserGame[]>(dummyGames)
  const [serverOnline, setServerOnline] = useState<boolean>(true)
  const [onlineCount, setOnlineCount] = useState<number>(1429)

  useEffect(() => {
    const userId = 1
    ;(async () => {
      try {
        const userRes: ApiResponse<User> = await getUserById(userId)
        if (userRes?.success && userRes.data) setUser(userRes.data)
      } catch (_) {
        // Fallback already set to dummy
      }
      try {
        const gamesRes = await getUserGames(userId)
        if (gamesRes?.success && gamesRes.data) setRecentGames(gamesRes.data.slice(0, 3))
      } catch (_) {
        // Fallback already set to dummy
      }
    })()
  }, [])

  const handleStartGame = () => {
    navigate('/matchmaking')
  }

  const handleDeck = () => {
    navigate('/deck-builder')
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / (60 * 1000))
    if (mins < 60) return `${mins} mins ago`
    const hours = Math.floor(mins / 60)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }

  const resultBadge = (r: UserGame['result']) => {
    const map = {
      WIN: 'bg-emerald-700/60 text-emerald-200',
      LOSE: 'bg-rose-700/60 text-rose-200',
      DRAW: 'bg-slate-700/60 text-slate-200',
    } as const
    const label = r === 'WIN' ? 'WIN' : r === 'LOSE' ? 'LOSE' : 'DRAW'
    return (
      <span className={`px-3 py-1 rounded-md text-xs font-bold tracking-wide ${map[r]}`}>{label}</span>
    )
  }

  const ratingDelta = (d: number) => {
    const positive = d > 0
    const color = positive ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-slate-400'
    const sign = positive ? '+' : ''
    return <span className={`text-sm ${color}`}>{`${sign}${d} pts`}</span>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Nav */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 grid place-items-center rounded-sm bg-yellow-500 text-gray-900 font-black">♟</div>
            <span className="font-semibold">Mad Chess</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">Grandmaster Rank</div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-800">
              <span className="text-yellow-400">★</span>
              <span className="font-semibold">{user.rating}</span>
            </div>
            <div className="flex items-center gap-2">
              <img
                src={`https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.username)}`}
                alt="avatar"
                className="h-8 w-8 rounded-full bg-slate-700"
              />
              <span className="text-sm text-slate-200">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6">
        {/* Hero Banner */}
        <section className="mt-8 rounded-xl border border-gray-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-gray-900 overflow-hidden">
          <div className="px-10 py-12">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
              <span className="text-slate-200">Master the </span>
              <span className="text-yellow-400">Board</span>
            </h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Experience Mad Chess: The ultimate PvP chess deck-builder. Collect cards, craft your strategy, and crush your opponents.
            </p>
            <button
              onClick={handleStartGame}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-6 py-3 font-semibold text-gray-900 hover:bg-yellow-400 transition-colors"
            >
              START GAME <span>♔ ♝ ♛</span>
            </button>
          </div>
        </section>

        {/* Recent Matches */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Matches</h2>
            <button className="text-xs text-yellow-400 hover:underline">View History</button>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-800">
            <div className="grid grid-cols-12 bg-slate-800/60 px-4 py-3 text-xs text-slate-300">
              <div className="col-span-3">SIDE</div>
              <div className="col-span-3">RESULT</div>
              <div className="col-span-3">RATING CHANGE</div>
              <div className="col-span-3">TIME</div>
            </div>
            <ul className="divide-y divide-gray-800">
              {recentGames.map((g, idx) => (
                <li key={g.gameId} className="grid grid-cols-12 items-center px-4 py-4 bg-slate-900/40">
                  <div className="col-span-3 flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${idx % 2 === 0 ? 'bg-white' : 'bg-black border border-slate-500'}`}></span>
                    <span className="text-slate-200">{idx % 2 === 0 ? 'White' : 'Black'}</span>
                  </div>
                  <div className="col-span-3">{resultBadge(g.result)}</div>
                  <div className="col-span-3">{ratingDelta(g.ratingChange)}</div>
                  <div className="col-span-3 text-sm text-slate-400">{timeAgo(g.playedAt)}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Actions */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={handleDeck}
            className="rounded-xl border border-gray-800 bg-slate-800/40 px-6 py-6 text-left hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📦</span>
              <span className="font-semibold">내 덱</span>
            </div>
          </button>
          <button
            className="rounded-xl border border-gray-800 bg-slate-800/40 px-6 py-6 text-left hover:bg-slate-800/60 transition-colors"
            onClick={() => navigate('/')}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <span className="font-semibold">리더보드</span>
            </div>
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-gray-800">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>
              Server Status: <span className={`font-medium ${serverOnline ? 'text-emerald-400' : 'text-rose-400'}`}>{serverOnline ? 'Online' : 'Offline'}</span>
            </span>
            <span>Players: {onlineCount.toLocaleString()} Online</span>
          </div>
          <div>© 2024 Mad Chess Studio. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
