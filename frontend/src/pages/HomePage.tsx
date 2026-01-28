import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserGames } from '../services/userApi'
import { useAuthStore } from '../stores/authStore'
import { socketService } from '../services/socket'
import type { UserGame } from '../types/api.types'

interface LiveGame {
  matchId: string
  white: { username: string; rating: number }
  black: { username: string; rating: number }
  timeControl: string
  spectatorCount: number
  currentTurn: 'white' | 'black'
  board: any
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user: authUser, isAuthenticated } = useAuthStore()

  const [recentGames, setRecentGames] = useState<UserGame[]>([])
  const [serverOnline, setServerOnline] = useState<boolean>(true)
  const [onlineCount, setOnlineCount] = useState<number>(0)
  const [gamesToday, setGamesToday] = useState<number>(0)
  const [liveGames, setLiveGames] = useState<LiveGame[]>([])
  const [showDonation, setShowDonation] = useState(false)

  useEffect(() => {
    if (authUser?.id) {
      getUserGames(authUser.id).then(res => {
        if (res.success && res.data) setRecentGames(res.data.games.slice(0, 3))
      })
    }
  }, [authUser])

  // Fetch live games on mount
  useEffect(() => {
    socketService.connect()

    const handleLiveGames = (data: { games: LiveGame[] }) => {
      console.log('📺 Live games received:', data.games)
      setLiveGames(data.games)
    }

    socketService.onLiveGames(handleLiveGames)
    socketService.requestLiveGames()

    // Handle Server Stats
    const handleServerStats = (data: { gamesToday: number; onlineUsers: number }) => {
      setGamesToday(data.gamesToday)
      setOnlineCount(data.onlineUsers)
    }
    socketService.onServerStats(handleServerStats)
    socketService.requestServerStats()

    // Refresh live games and stats every 10 seconds
    const interval = setInterval(() => {
      socketService.requestLiveGames()
      socketService.requestServerStats()
    }, 10000)

    return () => {
      clearInterval(interval)
      socketService.offLiveGames()
      socketService.offServerStats()
    }
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
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    return `${hours}h`
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden flex flex-col font-sans relative">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-gray-900 z-10">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowDonation(false)}>
            <div className="w-8 h-8 bg-white skew-x-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-80"></div>
            </div>
            <div>
              <div className="font-serif text-2xl leading-none tracking-tight text-[#D4FF00]">MAD</div>
              <div className="font-serif text-2xl leading-none tracking-tight text-white">CHESS</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400 uppercase tracking-widest">
            <button onClick={() => { setShowDonation(false); navigate('/deck-builder') }} className="hover:text-white transition-colors">Deck</button>
            <button onClick={() => setShowDonation(true)} className={`${showDonation ? 'text-white' : 'hover:text-white'} transition-colors`}>Donation</button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isAuthenticated && authUser ? (
            <button onClick={() => navigate('/mypage')} className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-white group-hover:text-[#D4FF00] transition-colors">{authUser.name}</div>
                <div className="text-xs text-gray-500 font-mono">{authUser.rating !== undefined ? Math.round(authUser.rating) : '?'} ELO</div>
              </div>
              <img
                src={authUser.picture || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(authUser.name || 'User')}`}
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
              <span className="text-8xl font-serif font-light leading-none">{gamesToday}</span>
              <span className="text-lg mt-2 ml-1">↗</span>
            </div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2 ml-1">Matches Today</div>
          </div>

          <div>
            <div className="flex items-start text-white">
              <span className="text-8xl font-serif font-light leading-none">{onlineCount}</span>
              <span className="text-lg mt-2 ml-1 text-[#D4FF00]">↗</span>
            </div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2 ml-1">Players Online</div>
          </div>
        </div>

        {/* Center/Right Content */}
        <div className="col-span-1 lg:col-span-9 relative flex flex-col">
          {showDonation ? (
            <div className="flex-1 flex flex-col justify-center items-center p-12 text-center z-20">
              <h2 className="text-4xl font-serif text-[#D4FF00] mb-8">Support Development</h2>
              <div className="bg-[#0A0A0A] border border-gray-800 p-8 max-w-lg w-full mb-8">
                <div className="mb-6 border-b border-gray-800 pb-6">
                  <p className="text-gray-500 uppercase tracking-widest text-sm mb-4">Donation Account 1</p>
                  <p className="text-2xl text-white font-mono break-all select-all">41780204068358</p>
                  <p className="text-xl text-gray-400 mt-2 font-serif">국민은행 탁한진</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase tracking-widest text-sm mb-4">Donation Account 2</p>
                  <p className="text-2xl text-white font-mono break-all select-all">1002961962863</p>
                  <p className="text-xl text-gray-400 mt-2 font-serif">우리은행 정재우</p>
                </div>
              </div>

              <div className="mb-8 p-4 border border-[#D4FF00]/30 bg-[#D4FF00]/5 rounded animate-pulse">
                <p className="text-[#D4FF00] font-serif text-lg">
                  "부산대학교 안준영님 100원 후원 감사합니다"
                </p>
              </div>
              <button
                onClick={() => setShowDonation(false)}
                className="px-8 py-3 bg-[#D4FF00] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
              >
                Back to Main
              </button>
            </div>
          ) : (
            <>
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
                {/* Live Games Section */}
                {liveGames.length > 0 && (
                  <div className="mb-10">
                    <h2 className="text-2xl font-serif text-white mb-6 flex items-center gap-4">
                      <span className="w-2 h-2 bg-red-500 animate-pulse"></span>
                      Live Games
                      <span className="text-sm text-gray-500 font-mono ml-2">({liveGames.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {liveGames.slice(0, 6).map((game) => (
                        <button
                          key={game.matchId}
                          onClick={() => navigate(`/spectate/${game.matchId}`)}
                          className="bg-[#0A0A0A] border border-gray-800 p-4 hover:border-[#D4FF00] transition-all group text-left"
                        >
                          <div className="flex justify-between items-center mb-3 text-xs tracking-widest text-gray-500 uppercase">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                              LIVE
                            </span>
                            <span>{game.timeControl}</span>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className={`text-sm font-bold ${game.currentTurn === 'white' ? 'text-[#D4FF00]' : 'text-white'}`}>
                                {game.white.username}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">{Math.round(game.white.rating)}</div>
                            </div>
                            <div className="text-gray-500 text-xs">vs</div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${game.currentTurn === 'black' ? 'text-[#D4FF00]' : 'text-white'}`}>
                                {game.black.username}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">{Math.round(game.black.rating)}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>👁️ {game.spectatorCount} watching</span>
                            <span className="text-[#D4FF00] group-hover:underline">Watch →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                              <div className="text-lg font-bold text-white truncate">{typeof game.opponent === 'object' ? (game.opponent as any).username : game.opponent}</div>
                            </div>
                            <div className={`text-xl font-mono ${game.ratingChange > 0 ? 'text-[#D4FF00]' : 'text-gray-500'}`}>
                              {game.ratingChange > 0 ? '+' : ''}{Math.round(game.ratingChange)}
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
                  <div className="h-full flex flex-col justify-center items-center text-center">
                    <h1 className="text-6xl md:text-8xl font-serif font-light leading-none mb-6">
                      <span className="block text-white">CHESS,</span>
                      <span className="block text-[#D4FF00]">BUILT</span>
                      <span className="block text-white">DIFFERENT.</span>
                    </h1>
                    <p className="text-gray-400 max-w-md text-lg font-light tracking-wide">
                      Don't just play the board. Architect the kill. <br />A new meta driven by 30-point madness.
                    </p>
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
            </>
          )}
        </div>

      </main>
    </div>
  )
}
