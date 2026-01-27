import { useEffect, useState, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserGames } from '../services/userApi'
import { useAuthStore } from '../stores/authStore'
import type { UserGame } from '../types/api.types'
import Hero3D from '../components/Hero3D'

export default function HomePage() {
  const navigate = useNavigate()
  const { user: authUser, isAuthenticated } = useAuthStore()

  const [recentGames, setRecentGames] = useState<UserGame[]>([])
  const [userStats, setUserStats] = useState<{ totalGames: number; winRate: number } | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean>(true)
  const [onlineCount, setOnlineCount] = useState<number>(1429)

  useEffect(() => {
    if (authUser?.id) {
      getUserGames(authUser.id).then(res => {
        if (res.success && res.data) setRecentGames(res.data.games.slice(0, 3))
      })
      // Fetch user stats (mocked or real)
      // Note: Assuming logic to calculate stats if API doesn't return them directly in this view, 
      // but assuming getUserStats is available or we derive from games for now to be safe if types mismatch.
      // Actually we imported getUserStats from userApi, let's use it.
      import('../services/userApi').then(({ getUserStats }) => {
        getUserStats(authUser.id).then(res => {
          if (res.success && res.data) {
            setUserStats(res.data)
          }
        })
      })
    }
  }, [authUser])

  const handleStartGame = () => {
    navigate('/matchmaking')
  }

  const handleDeck = () => {
    navigate('/deck-builder')
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / (60 * 1000))
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    return `${hours}h`
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden flex flex-col font-sans relative">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-gray-900 z-10">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white skew-x-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
            </div>
            <div>
              <div className="font-serif text-2xl leading-none tracking-tight text-[#D4FF00]">MAD</div>
              <div className="font-serif text-2xl leading-none tracking-tight text-white">CHESS</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400 uppercase tracking-widest">
            <button onClick={() => navigate('/deck-builder')} className="hover:text-white transition-colors">Deck</button>
            <button className="hover:text-white transition-colors">Tournaments</button>
            <button className="hover:text-white transition-colors">Leaderboard</button>
            <button className="hover:text-white transition-colors">Watch</button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isAuthenticated && authUser ? (
            <button onClick={() => navigate('/mypage')} className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-white group-hover:text-[#D4FF00] transition-colors">{authUser.name}</div>
                <div className="text-xs text-gray-500 font-mono">{authUser.rating || 1500} ELO</div>
              </div>
              <img
                src={authUser.picture || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(authUser.name)}`}
                alt="Avatar"
                className="w-10 h-10 rounded-sm border border-gray-700 group-hover:border-[#D4FF00] transition-colors"
              />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-[#D4FF00] font-bold border border-[#D4FF00] px-6 py-2 hover:bg-[#D4FF00] hover:text-black transition-all uppercase tracking-wider text-sm"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative">

        {/* Left Stats Column */}
        <div className="hidden lg:flex lg:col-span-3 flex-col justify-center px-12 border-r border-gray-900 z-10 bg-[#050505]">
          <div className="mb-16">
            <div className="flex items-start text-[#D4FF00]">
              <span className="text-8xl font-serif font-light leading-none">
                {isAuthenticated && userStats ? userStats.totalGames : '53'}
              </span>
              <span className="text-lg mt-2 ml-1">↗</span>
            </div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2 ml-1">
              {isAuthenticated ? 'Total Matches' : 'Tournaments Today'}
            </div>
          </div>

          <div>
            <div className="flex items-start text-white">
              <span className="text-8xl font-serif font-light leading-none">
                {isAuthenticated && userStats ?
                  (userStats.winRate > 1 ? userStats.winRate : Math.round(userStats.winRate * 100))
                  : onlineCount}
              </span>
              <span className="text-lg mt-2 ml-1 text-[#D4FF00]">
                {isAuthenticated ? '%' : '↗'}
              </span>
            </div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2 ml-1">
              {isAuthenticated ? 'Win Rate' : 'Grandmasters Online'}
            </div>
          </div>
        </div>

        {/* Center/Right Content */}
        <div className="col-span-1 lg:col-span-9 relative flex flex-col">
          {/* Background Graphic */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute right-0 top-0 w-3/4 h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-[#050505] to-[#050505]"></div>
            <div className="grid grid-cols-8 grid-rows-8 h-full w-full absolute top-0 right-0 opacity-10">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className={`border border-gray-800 ${((Math.floor(i / 8) + i) % 2 === 0) ? 'bg-transparent' : 'bg-gray-900/50'}`}></div>
              ))}
            </div>
          </div>

          {/* Recent Games Area */}
          <div className="flex-1 p-8 lg:p-12 z-10 overflow-y-auto">
            {isAuthenticated ? (
              <div>
                <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-4">
                  <span className="w-2 h-2 bg-[#D4FF00]"></span>
                  Recent Matches
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {recentGames.map((game) => (
                    <div key={game.gameId} className="bg-[#0A0A0A] border border-gray-800 p-4 hover:border-[#D4FF00] transition-colors group">
                      <div className="flex justify-between items-center mb-4 text-xs tracking-widest text-gray-500 uppercase">
                        <span>{timeAgo(game.playedAt)} AGO</span>
                        <span className={game.result === 'WIN' ? 'text-[#D4FF00]' : 'text-gray-400'}>{game.result}</span>
                      </div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1">
                          <div className="text-sm text-gray-400">VS</div>
                          <div className="text-lg font-bold text-white truncate">{game.opponent}</div>
                        </div>
                        <div className={`text-xl font-mono ${game.ratingChange > 0 ? 'text-[#D4FF00]' : 'text-gray-500'}`}>
                          {game.ratingChange > 0 ? '+' : ''}{game.ratingChange}
                        </div>
                      </div>
                      <div className="h-1 w-full bg-gray-900 relative overflow-hidden">
                        <div className={`absolute left-0 top-0 h-full ${game.result === 'WIN' ? 'bg-[#D4FF00] w-full' : 'bg-gray-700 w-1/3'}`}></div>
                      </div>
                    </div>
                  ))}
                  {recentGames.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 border border-gray-900 border-dashed">
                      NO REGENT GAMES PLAYED
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col lg:flex-row items-center justify-center gap-8 px-8">
                {/* 3D Queen */}
                <div className="flex-1 w-full max-w-2xl h-[500px] lg:h-[600px] -ml-12">
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center text-gray-500">
                      Loading 3D Scene...
                    </div>
                  }>
                    <Hero3D />
                  </Suspense>
                </div>

                {/* Text Content */}
                <div className="flex-1 text-center lg:text-left">
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-light leading-none mb-6">
                    <span className="block text-white">WORLD</span>
                    <span className="block text-[#D4FF00]">CLASS</span>
                    <span className="block text-white">STRATEGY</span>
                  </h1>
                  <p className="text-gray-400 max-w-md text-lg font-light tracking-wide mx-auto lg:mx-0">
                    Join the ultimate deck-building chess arena. Compete globally.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="p-8 lg:px-12 lg:py-8 border-t border-gray-900 bg-[#050505] z-20 flex justify-between items-center">
            <div className="hidden sm:flex items-center gap-8 text-xs text-gray-500 font-mono">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-[#D4FF00]' : 'bg-red-500'} animate-pulse`}></div>
                SERVER {serverOnline ? 'ONLINE' : 'OFFLINE'}
              </div>
              <div>PING: 24ms</div>
              <div>VER: 2.1.0</div>
            </div>

            <button
              onClick={handleStartGame}
              className="w-full sm:w-auto bg-[#D4FF00] text-black text-4xl sm:text-5xl font-black px-12 py-6 hover:bg-white hover:scale-105 transition-all uppercase leading-none skew-x-[-10deg]"
              style={{ fontFamily: "'Zilla Slab', serif" }}
            >
              Start Game
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
