import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socketService } from '../services/socket'
import ChessBoard from '../components/ChessBoard'
import { Piece, PieceColor, Move } from '../types/game'
import { EvalBar } from './GamePage'

interface PlayerInfo {
    username: string
    rating: number
}

export default function SpectatorPage() {
    const { matchId } = useParams<{ matchId: string }>()
    const navigate = useNavigate()

    const [board, setBoard] = useState<(Piece | null)[][]>([])
    const [currentTurn, setCurrentTurn] = useState<PieceColor>('white')
    const [white, setWhite] = useState<PlayerInfo>({ username: 'White', rating: 1500 })
    const [black, setBlack] = useState<PlayerInfo>({ username: 'Black', rating: 1500 })
    // Displayed Time
    const [whiteTime, setWhiteTime] = useState(600000)
    const [blackTime, setBlackTime] = useState(600000)

    // Server Truth (Reference for absolute sync)
    const [serverWhiteTime, setServerWhiteTime] = useState(600000)
    const [serverBlackTime, setServerBlackTime] = useState(600000)
    const [lastMoveTime, setLastMoveTime] = useState<number | undefined>(undefined)

    const [timeControl, setTimeControl] = useState('10+0')
    const [pgn, setPgn] = useState('')
    const [isCheck, setIsCheck] = useState(false)
    const [lastMove, setLastMove] = useState<Move | null>(null)
    const [gameOver, setGameOver] = useState<{ winner: string; reason: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [evalScore, setEvalScore] = useState<{ type: 'cp' | 'mate', value: number } | null>(null)

    // Timer interval refs
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        socketService.connect()

        // Handle spectate joined
        const handleSpectateJoined = (data: any) => {
            console.log('👁️ Spectate joined:', data)
            setIsLoading(false)

            if (data.gameState) {
                setBoard(data.gameState.board || [])
                setCurrentTurn(data.gameState.currentTurn || 'white')
                setIsCheck(data.gameState.isCheck || false)
            }

            if (data.white) setWhite(data.white)
            if (data.black) setBlack(data.black)
            if (data.whiteTime !== undefined) {
                setWhiteTime(data.whiteTime)
                setServerWhiteTime(data.whiteTime)
            }
            if (data.blackTime !== undefined) {
                setBlackTime(data.blackTime)
                setServerBlackTime(data.blackTime)
            }
            if (data.lastMoveTime !== undefined) setLastMoveTime(data.lastMoveTime)
            if (data.timeControl) setTimeControl(data.timeControl)
            if (data.pgn) setPgn(data.pgn)
        }

        // Handle move made (real-time updates)
        const handleMoveMade = (data: any) => {
            console.log('📺 Move received:', data)

            if (data.gameState) {
                setBoard(data.gameState.board || [])
                setCurrentTurn(data.gameState.currentTurn || 'white')
                setIsCheck(data.gameState.isCheck || false)
                if (data.gameState.pgn) setPgn(data.gameState.pgn)
            }

            if (data.move) {
                setLastMove(data.move)
            }

            if (data.whiteTime !== undefined) {
                setWhiteTime(data.whiteTime)
                setServerWhiteTime(data.whiteTime)
            }
            if (data.blackTime !== undefined) {
                setBlackTime(data.blackTime)
                setServerBlackTime(data.blackTime)
            }
            if (data.lastMoveTime !== undefined) setLastMoveTime(data.lastMoveTime)
        }

        // Handle game over
        const handleGameOver = (data: { winner: string; reason: string }) => {
            console.log('🏁 Game over:', data)
            setGameOver(data)
        }

        // Handle spectate error
        const handleSpectateError = (data: { message: string }) => {
            console.error('❌ Spectate error:', data.message)
            setError(data.message)
            setIsLoading(false)
        }

        socketService.onSpectateJoined(handleSpectateJoined)
        socketService.onMoveMade(handleMoveMade)
        socketService.onGameOver(handleGameOver)
        socketService.onGameOver(handleGameOver)
        socketService.onSpectateError(handleSpectateError)

        socketService.onAnalysisResult((results: any[]) => {
            if (results && results.length > 0) {
                setEvalScore({ type: results[0].type, value: results[0].value })
            }
        })

        // Join as spectator
        if (matchId) {
            socketService.spectateGame(matchId)
        }

        return () => {
            // Leave spectating on unmount
            if (matchId) {
                socketService.leaveSpectate(matchId)
            }
            socketService.offSpectateJoined()
            socketService.offMoveMade()
            socketService.offGameOver()
            socketService.offMoveMade()
            socketService.offGameOver()
            socketService.offSpectateError()
            socketService.offAnalysisResult()

            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [matchId])

    useEffect(() => {
        if (matchId) {
            socketService.requestAnalysis(matchId)
        }
    }, [matchId, pgn, lastMove, board])

    // Timer countdown (client-side)
    useEffect(() => {
        if (gameOver) {
            if (timerRef.current) clearInterval(timerRef.current)

            // Auto-redirect countdown
            const redirectTimer = setTimeout(() => {
                navigate('/')
            }, 5000) // 5 seconds

            return () => clearTimeout(redirectTimer)
        }

        timerRef.current = setInterval(() => {
            if (!lastMoveTime) return

            const now = Date.now()
            const elapsed = now - lastMoveTime

            // Absolute sync: Display = ServerTime - (Now - LastMoveTime)
            if (currentTurn === 'white') {
                setWhiteTime(Math.max(0, serverWhiteTime - elapsed))
                setBlackTime(serverBlackTime) // Black's time is static during White's turn
            } else {
                setWhiteTime(serverWhiteTime) // White's time is static during Black's turn
                setBlackTime(Math.max(0, serverBlackTime - elapsed))
            }
        }, 50) // Update frequently for smooth UI

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [currentTurn, gameOver, navigate, lastMoveTime, serverWhiteTime, serverBlackTime])

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl animate-pulse mb-4">📺</div>
                    <div className="text-xl font-serif">Joining game...</div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">❌</div>
                    <div className="text-xl font-serif mb-4">{error}</div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-[#D4FF00] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans">
            {/* Header */}
            <header className="border-b border-gray-900 bg-[#050505]/90 backdrop-blur sticky top-0 z-10">
                <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/')}
                        className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
                    >
                        <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="uppercase tracking-widest text-xs font-bold">Back to Home</span>
                    </button>
                    <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
                        <div className="px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase tracking-widest animate-pulse">
                            LIVE
                        </div>
                        <div className="font-serif text-lg">
                            <span className="text-[#D4FF00]">MAD</span>
                            <span className="text-white">CHESS</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-start">
                    {/* Left: Black Player Info */}
                    <div className="order-2 lg:order-1 flex flex-col items-center lg:items-end gap-4">
                        <div className="text-center lg:text-right">
                            <div className="text-2xl font-bold text-white">{black.username}</div>
                            <div className="text-sm text-gray-500 font-mono">{black.rating} ELO</div>
                        </div>
                        <div className={`text-4xl font-mono px-6 py-3 border ${currentTurn === 'black' ? 'border-[#D4FF00] text-[#D4FF00] bg-[#D4FF00]/10' : 'border-gray-800 text-gray-400'}`}>
                            {formatTime(blackTime)}
                        </div>
                    </div>

                    {/* Center: Chess Board */}
                    <div className="order-1 lg:order-2 flex gap-4 justify-center items-start h-[650px]">
                        <div className="h-[600px] shrink-0 pt-8 pb-8 flex flex-col items-center">
                            <EvalBar evaluation={evalScore} />
                        </div>
                        <div className="flex flex-col items-center">
                            <ChessBoard
                                board={board}
                                currentTurn={currentTurn}
                                myColor="white" // Always show from white's perspective
                                isMyTurn={false}
                                lastMove={lastMove || undefined}
                                isCheck={isCheck}
                                onMove={() => { }} // No-op for spectators
                                useImages={true}
                                isSpectator={true}
                            />

                            {/* Time Control Badge */}
                            <div className="mt-4 px-4 py-2 bg-[#0A0A0A] border border-gray-800 text-sm text-gray-400 uppercase tracking-widest">
                                {timeControl}
                            </div>

                            {/* Spectator Badge */}
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                                <span>👁️</span>
                                <span>Watching Live</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: White Player Info */}
                    <div className="order-3 flex flex-col items-center lg:items-start gap-4">
                        <div className="text-center lg:text-left">
                            <div className="text-2xl font-bold text-white">{white.username}</div>
                            <div className="text-sm text-gray-500 font-mono">{white.rating} ELO</div>
                        </div>
                        <div className={`text-4xl font-mono px-6 py-3 border ${currentTurn === 'white' ? 'border-[#D4FF00] text-[#D4FF00] bg-[#D4FF00]/10' : 'border-gray-800 text-gray-400'}`}>
                            {formatTime(whiteTime)}
                        </div>
                    </div>
                </div>

                {/* Game Over Overlay */}
                {gameOver && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div className="bg-[#0A0A0A] border border-gray-800 p-10 text-center max-w-md">
                            <div className="text-4xl mb-4">🏁</div>
                            <h2 className="text-3xl font-serif text-white mb-2">Game Over</h2>
                            <p className="text-xl text-[#D4FF00] mb-2">{gameOver.winner === 'draw' ? 'Draw' : `${gameOver.winner.charAt(0).toUpperCase() + gameOver.winner.slice(1)} wins!`}</p>
                            <p className="text-gray-500 mb-6 uppercase tracking-widest text-sm">{gameOver.reason}</p>
                            <button
                                onClick={() => navigate('/')}
                                className="px-8 py-3 bg-[#D4FF00] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
