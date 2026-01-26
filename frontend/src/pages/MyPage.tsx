import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { getUserGames, updateUser } from '../services/userApi'
import type { UserGame } from '../types/api.types'

export default function MyPage() {
    const navigate = useNavigate()
    const { user, logout, setUser } = useAuthStore()
    const [matchHistory, setMatchHistory] = useState<UserGame[]>([])
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')

    useEffect(() => {
        if (user?.id) {
            getUserGames(user.id).then((res) => {
                if (res.success && res.data) {
                    setMatchHistory(res.data.games)
                }
            })
        }
    }, [user])

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

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime()
        const mins = Math.floor(diff / (60 * 1000))
        if (mins < 60) return `${mins} mins ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
        return new Date(iso).toLocaleDateString()
    }

    if (!user) return <div className="text-white p-10">Loading...</div>

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        ← Back to Home
                    </button>
                    <div className="text-xl font-bold">My Profile</div>
                    <div className="w-16"></div> {/* Spacer for center alignment */}
                </div>

                {/* Profile Card */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8">
                    <img
                        src={user.picture || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.name)}`}
                        alt="Profile"
                        className="w-32 h-32 rounded-full border-4 border-slate-700"
                    />
                    <div className="flex-1 text-center md:text-left">
                        {isEditing ? (
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-white text-xl font-bold rounded-lg px-3 py-1 focus:outline-none focus:border-blue-500"
                                />
                                <button onClick={handleSaveName} className="text-emerald-400 hover:text-emerald-300">
                                    ✓
                                </button>
                                <button onClick={() => setIsEditing(false)} className="text-rose-400 hover:text-rose-300">
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-2 group">
                                <h1 className="text-3xl font-bold">{user.name}</h1>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white"
                                >
                                    ✎
                                </button>
                            </div>
                        )}
                        <p className="text-slate-400 mb-4">{user.email}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4">
                            <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 block">Rating</span>
                                <span className="text-xl font-bold text-yellow-400">1500</span>
                            </div>
                            <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 block">Matches</span>
                                <span className="text-xl font-bold text-white">{matchHistory.length}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-6 py-3 bg-rose-600/20 text-rose-400 border border-rose-600/50 rounded-xl hover:bg-rose-600/30 transition-colors font-semibold"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-4 text-slate-200">Win Rate</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-emerald-400">
                                {matchHistory.length > 0
                                    ? Math.round((matchHistory.filter(m => m.result === 'WIN').length / matchHistory.length) * 100)
                                    : 0}%
                            </span>
                            <span className="text-slate-500 mb-1">
                                ({matchHistory.filter(m => m.result === 'WIN').length}W - {matchHistory.filter(m => m.result === 'LOSE').length}L)
                            </span>
                        </div>
                    </div>
                    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-4 text-slate-200">Favorite Deck</h3>
                        <div className="text-xl font-medium text-purple-300">Aggressive Knight Rush</div>
                        <div className="text-xs text-slate-500 mt-1">Used in 12 matches</div>
                    </div>
                </div>

                {/* Match History */}
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                        <h3 className="font-semibold text-slate-200">Match History</h3>
                    </div>
                    {matchHistory.length > 0 ? (
                        <div className="divide-y divide-slate-700/50">
                            {matchHistory.map((game) => (
                                <div key={game.gameId} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${true ? 'bg-white' : 'bg-black border border-slate-500'}`} />
                                        <div>
                                            <div className="font-medium text-slate-200">vs {game.opponent}</div>
                                            <div className="text-xs text-slate-500">{timeAgo(game.playedAt)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className={`text-sm font-medium ${game.ratingChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {game.ratingChange > 0 ? '+' : ''}{game.ratingChange}
                                        </div>
                                        {resultBadge(game.result)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            No matches played yet. Go play some chess!
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
