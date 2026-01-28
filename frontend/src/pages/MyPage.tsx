import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { getUserGames, getUserStats, updateUser, getUserDecks } from '../services/userApi'
import type { UserGame, UserStats, DeckWithStats } from '../types/api.types'
import RatingDisplay from '../components/rating/RatingDisplay'

export default function MyPage() {
    const navigate = useNavigate()
    const { user, logout, setUser } = useAuthStore()
    const [matchHistory, setMatchHistory] = useState<UserGame[]>([])
    const [stats, setStats] = useState<UserStats | null>(null)
    const [userDecks, setUserDecks] = useState<DeckWithStats[]>([])
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [totalGames, setTotalGames] = useState(0)
    const ITEMS_PER_PAGE = 10

    useEffect(() => {
        if (user?.id) {
            // Fetch games with pagination
            const offset = (currentPage - 1) * ITEMS_PER_PAGE
            getUserGames(user.id, ITEMS_PER_PAGE, offset).then((res) => {
                if (res.success && res.data) {
                    setMatchHistory(res.data.games)
                    setTotalGames(res.data.total)
                }
            })

            // Stats are fetched separately, but we can also use totalGames for "Total Matches" if needed.
            // However, getUserStats might return aggregated data. Let's keep fetching it.
            getUserStats(user.id).then((res) => {
                if (res.success && res.data) {
                    setStats(res.data)
                }
            })

            // Fetch user decks
            getUserDecks(user.id).then((res) => {
                if (res.success && res.data) {
                    setUserDecks(res.data)
                }
            })
        }
    }, [user?.id, currentPage])

    useEffect(() => {
        if (user?.name) {
            setEditName(user.name)
        }
    }, [user])

    const handleLogout = () => {
        logout()
    }

    const handleSaveName = async () => {
        if (!user) return
        try {
            const res = await updateUser(user.id, editName)
            // @ts-ignore
            if (res.success || res.status === 200) { // Handle implicit success
                const updatedData = res.data || res
                // @ts-ignore
                setUser({ ...user, name: updatedData.username || editName })
                setIsEditing(false)
            }
        } catch (e: any) {
            alert(e.response?.data?.error?.message || "Failed to update username.")
        }
    }

    const resultBadge = (r: UserGame['result']) => {
        const color = r === 'WIN' ? 'text-[#D4FF00]' : 'text-gray-500'
        return (
            <span className={`text-xs font-bold tracking-wider uppercase ${color}`}>{r}</span>
        )
    }

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime()
        const mins = Math.floor(diff / (60 * 1000))
        if (mins < 60) return `${mins}m`
        const hours = Math.floor(mins / 60)
        return `${hours}h`
    }

    const totalPages = Math.ceil(totalGames / ITEMS_PER_PAGE)

    if (!user) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-mono">LOADING PROFILE...</div>

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header Actions */}
                <div className="flex items-center justify-between mb-12">
                    <button
                        onClick={() => navigate('/')}
                        className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
                    >
                        <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="uppercase tracking-widest text-xs font-bold">Back to Arena</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="text-xs font-bold text-gray-600 hover:text-red-500 uppercase tracking-widest transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Profile Section */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
                    {/* Left: Avatar & Rating */}
                    <div className="md:col-span-4 flex flex-col items-center md:items-start">
                        <div className="w-48 h-48 bg-gray-900 border border-gray-800 p-2 mb-6 relative group">
                            <img
                                src={user.picture || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.name || 'User')}`}
                                alt="Profile"
                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                            />
                            <div className="absolute -bottom-2 -right-2 bg-[#D4FF00] text-black text-xs font-bold px-3 py-1 uppercase tracking-widest">
                                Grandmaster
                            </div>
                        </div>

                        <div className="w-full">
                            <div className="text-gray-500 text-xs uppercase tracking-widest mb-3">Standard Rating</div>
                            <RatingDisplay
                                rating={user.rating || 1500}
                                rd={user.rd || 350}
                                variant="detailed"
                                showProvisional={true}
                            />
                        </div>
                    </div>

                    {/* Right: Info & Stats */}
                    <div className="md:col-span-8 flex flex-col justify-between">
                        <div className="mb-12">
                            {isEditing ? (
                                <div className="flex items-center gap-4 border-b border-[#D4FF00] pb-2 max-w-md">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="bg-transparent text-4xl font-serif text-white focus:outline-none w-full"
                                        autoFocus
                                    />
                                    <button onClick={handleSaveName} className="text-[#D4FF00] hover:text-white uppercase text-xs font-bold tracking-widest">Save</button>
                                    <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-white uppercase text-xs font-bold tracking-widest">Cancel</button>
                                </div>
                            ) : (
                                <div className="group flex items-end gap-6 border-b border-gray-800 pb-8 hover:border-[#D4FF00] transition-colors">
                                    <div>
                                        <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Player Name</div>
                                        <h1 className="text-5xl md:text-6xl font-serif text-white leading-none">{user.name}</h1>
                                    </div>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="mb-2 opacity-0 group-hover:opacity-100 text-[#D4FF00] uppercase text-xs font-bold tracking-widest transition-all"
                                    >
                                        Edit Profile
                                    </button>
                                </div>
                            )}
                            <div className="mt-4 text-gray-500 font-mono text-sm">{user.email}</div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="border-l border-gray-800 pl-6">
                                <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Total Matches</div>
                                <div className="text-3xl font-light">{totalGames}</div>
                            </div>
                            <div className="border-l border-gray-800 pl-6">
                                <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Win Rate</div>
                                <div className="text-3xl font-light text-[#D4FF00]">
                                    {stats ? Math.round(stats.winRate * 100) : 0}%
                                </div>
                            </div>
                            <div className="border-l border-gray-800 pl-6">
                                <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Favorite Deck</div>
                                <div className="text-lg leading-tight truncate">{stats?.favoriteDeck || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decks Section */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-serif text-white flex items-center gap-4">
                            <span className="w-2 h-2 bg-[#D4FF00]"></span>
                            Your Collection
                        </h2>
                        <button
                            onClick={() => window.location.href = 'https://madcamp.cloud/deck-builder'}
                            className="text-xs font-bold text-[#D4FF00] hover:text-white uppercase tracking-widest transition-colors"
                        >
                            Open Deck Builder →
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {userDecks.map(deck => (
                            <div key={deck.id} className="border border-gray-800 bg-[#0A0A0A] p-6 hover:border-[#D4FF00] transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-serif text-xl group-hover:text-[#D4FF00] transition-colors line-clamp-1">{deck.name}</h3>
                                    <span className="text-[10px] font-mono text-gray-600 bg-gray-900 px-2 py-1 uppercase whitespace-nowrap">{deck.totalCost} PTS</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Win Rate</div>
                                        <div className="text-xl font-light">{Math.round((deck.winRate || 0) * 100)}%</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Record</div>
                                        <div className="text-xl font-light">{deck.winCnt}W / {deck.loseCnt}L</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {userDecks.length === 0 && (
                            <div className="col-span-full py-12 border border-dashed border-gray-800 text-center text-gray-600">
                                NO DECKS FOUND. START BUILDING YOUR ARSENAL.
                            </div>
                        )}
                    </div>
                </div>

                {/* Match History Table */}
                <div>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-serif text-white flex items-center gap-4">
                            <span className="w-2 h-2 bg-[#D4FF00]"></span>
                            Match History
                        </h2>
                        <div className="text-gray-500 text-sm font-mono">
                            Page {currentPage} of {Math.max(1, totalPages)}
                        </div>
                    </div>

                    {matchHistory.length > 0 ? (
                        <>
                            <div className="border-t border-gray-800">
                                {matchHistory.map((game) => (
                                    <div
                                        key={game.gameId}
                                        className="group grid grid-cols-12 py-6 border-b border-gray-800 hover:bg-white/5 transition-colors items-center cursor-pointer"
                                        onClick={() => navigate(`/replay/${game.gameId}`)}
                                    >
                                        <div className="col-span-4 flex items-center gap-4">
                                            <div className={`w-3 h-3 ${game.result === 'WIN' ? 'bg-[#D4FF00]' : game.result === 'LOSE' ? 'bg-red-500' : 'bg-white'}`}></div>
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Opponent</div>
                                                <div className="font-bold text-lg">{typeof game.opponent === 'object' ? (game.opponent as any).username : game.opponent}</div>
                                            </div>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Result</div>
                                            {resultBadge(game.result)}
                                        </div>
                                        <div className="col-span-3">
                                            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Rating</div>
                                            <div className={`font-mono ${game.ratingChange > 0 ? 'text-[#D4FF00]' : 'text-gray-500'}`}>
                                                {game.ratingChange > 0 ? '+' : ''}{Math.round(game.ratingChange)}
                                            </div>
                                        </div>
                                        <div className="col-span-2 flex items-center justify-end gap-2">
                                            <span className="text-gray-500 font-mono text-xs">{timeAgo(game.playedAt)} AGO</span>
                                            <span className="text-gray-600 group-hover:text-[#D4FF00] transition-colors">→</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-12 mb-8">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="w-10 h-10 flex items-center justify-center border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:hover:text-gray-500 rounded transition-all"
                                    >
                                        &lt;
                                    </button>

                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const pageNum = i + 1;
                                        // Show limited pages if too many (simple implementation for now: show all, or limit?)
                                        // User requested "1,2,3,4...", let's show up to 7 or so.
                                        // For now, let's implement full list but truncated if huge (not expected yet).
                                        // Let's implement full list for simplicity as per request.
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-10 h-10 flex items-center justify-center font-mono text-sm transition-all ${currentPage === pageNum
                                                    ? 'bg-[#D4FF00] text-black font-bold'
                                                    : 'border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        )
                                    })}

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="w-10 h-10 flex items-center justify-center border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:hover:text-gray-500 rounded transition-all"
                                    >
                                        &gt;
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-24 border border-dashed border-gray-800 text-center text-gray-600">
                            NO MATCH DATA AVAILABLE
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
