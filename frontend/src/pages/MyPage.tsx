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
                                src={user.picture || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.name)}`}
                                alt="Profile"
                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                            />
                            <div className="absolute -bottom-2 -right-2 bg-[#D4FF00] text-black text-xs font-bold px-3 py-1 uppercase tracking-widest">
                                Grandmaster
                            </div>
                        </div>

                        <div className="w-full">
                            <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Standard Rating</div>
                            <div className="text-6xl font-serif font-light text-white leading-none flex items-start gap-2">
                                {1500}
                                <span className="text-lg text-[#D4FF00] mt-1">●</span>
                            </div>
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
                                <div className="text-3xl font-light">{matchHistory.length}</div>
                            </div>
                            <div className="border-l border-gray-800 pl-6">
                                <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Win Rate</div>
                                <div className="text-3xl font-light text-[#D4FF00]">
                                    {matchHistory.length > 0
                                        ? Math.round((matchHistory.filter(m => m.result === 'WIN').length / matchHistory.length) * 100)
                                        : 0}%
                                </div>
                            </div>
                            <div className="border-l border-gray-800 pl-6">
                                <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Favorite Deck</div>
                                <div className="text-lg leading-tight truncate">Aggro Knight Rush</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Match History Table */}
                <div>
                    <h2 className="text-2xl font-serif text-white mb-8 flex items-center gap-4">
                        <span className="w-2 h-2 bg-[#D4FF00]"></span>
                        Match History
                    </h2>

                    {matchHistory.length > 0 ? (
                        <div className="border-t border-gray-800">
                            {matchHistory.map((game) => (
                                <div key={game.gameId} className="group grid grid-cols-12 py-6 border-b border-gray-800 hover:bg-white/5 transition-colors items-center">
                                    <div className="col-span-4 flex items-center gap-4">
                                        <div className={`w-3 h-3 ${true ? 'bg-white' : 'bg-gray-800 border border-gray-600'}`}></div>
                                        <div>
                                            <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Opponent</div>
                                            <div className="font-bold text-lg">{game.opponent}</div>
                                        </div>
                                    </div>
                                    <div className="col-span-3">
                                        <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Result</div>
                                        {resultBadge(game.result)}
                                    </div>
                                    <div className="col-span-3">
                                        <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Rating</div>
                                        <div className={`font-mono ${game.ratingChange > 0 ? 'text-[#D4FF00]' : 'text-gray-500'}`}>
                                            {game.ratingChange > 0 ? '+' : ''}{game.ratingChange}
                                        </div>
                                    </div>
                                    <div className="col-span-2 text-right text-gray-500 font-mono text-xs">
                                        {timeAgo(game.playedAt)} AGO
                                    </div>
                                </div>
                            ))}
                        </div>
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
