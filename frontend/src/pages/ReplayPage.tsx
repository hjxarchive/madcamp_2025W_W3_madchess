
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGameReplay, getGameById } from '../services/gameApi'
import ChessBoard from '../components/ChessBoard'
import type { Game } from '../types/api.types'
import type { Move } from '../types/game'

export default function ReplayPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()

  const [history, setHistory] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [gameInfo, setGameInfo] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Load data
  useEffect(() => {
    if (!gameId) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [gameRes, replayRes] = await Promise.all([
          getGameById(parseInt(gameId)),
          getGameReplay(gameId)
        ])

        if (gameRes.success && gameRes.data) {
          setGameInfo(gameRes.data)
        }

        if (replayRes.success && replayRes.data) {
          setHistory(replayRes.data)
          setCurrentIndex(0)
        }
      } catch (err) {
        console.error("Failed to load replay data", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [gameId])

  // Key controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === ' ') togglePlay()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, history.length])

  // Auto play
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev < history.length - 1) return prev + 1
          setIsPlaying(false)
          return prev
        })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, history.length])

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
    setIsPlaying(false)
  }

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(history.length - 1, prev + 1))
    setIsPlaying(false)
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-mono">
        LOADING REPLAY...
      </div>
    )
  }

  if (!history.length) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-mono gap-4">
        <div>NO REPLAY DATA AVAILABLE (PGN NOT FOUND)</div>
        <button
          onClick={() => navigate('/mypage')}
          className="text-[#D4FF00] underline"
        >
          Back to My Page
        </button>
      </div>
    )
  }

  const currentState = history[currentIndex]

  // Construct Move object compatible with ChessBoard types
  let lastMove: Move | undefined = undefined
  if (currentState.lastMove) {
    const { from, to, promotion } = currentState.lastMove
    const uci = promotion ? `${from}${to}${promotion}` : `${from}${to}`
    lastMove = {
      uci,
      piece: 'p', // Dummy piece type, only uci is used for highlighting
    } as Move
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#050505]/90 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/mypage')} className="text-gray-500 hover:text-white transition-colors">
            ← BACK
          </button>
          <div className="font-serif text-lg">
            <span className="text-[#D4FF00]">REPLAY</span> MODE
          </div>
        </div>
        {gameInfo && (
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${gameInfo.result === 'white_win' ? 'bg-[#D4FF00]' : 'bg-gray-700'}`}></div>
              <span>{typeof gameInfo.player1.username === 'string' ? gameInfo.player1.username : (gameInfo.player1 as any).username} (White)</span>
            </div>
            <div className="text-gray-600">VS</div>
            <div className="flex items-center gap-2">
              <span>{typeof gameInfo.player2.username === 'string' ? gameInfo.player2.username : (gameInfo.player2 as any).username} (Black)</span>
              <div className={`w-3 h-3 rounded-full ${gameInfo.result === 'black_win' ? 'bg-[#D4FF00]' : 'bg-gray-700'}`}></div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6">
        <div className="relative">
          <ChessBoard
            board={currentState.board}
            currentTurn={currentState.turn}
            myColor="white"
            isMyTurn={false}
            lastMove={lastMove}
            onMove={() => { }}
            isCheck={false} // TODO: Add check status to replay data
          />
        </div>

        {/* Controls Panel */}
        <div className="bg-[#0A0A0A] border border-gray-800 p-6 w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="text-gray-500 text-xs uppercase tracking-widest">Move</div>
            <div className="text-2xl font-mono text-[#D4FF00]">
              {currentIndex} <span className="text-gray-600 text-lg">/ {history.length - 1}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setCurrentIndex(0)}
              disabled={currentIndex === 0}
              className="p-3 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
            >
              ⏮
            </button>
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded transition-colors w-12 h-12 flex items-center justify-center"
            >
              ◀
            </button>
            <button
              onClick={togglePlay}
              className="p-3 bg-[#D4FF00] text-black hover:bg-white rounded transition-colors w-16 h-16 flex items-center justify-center text-2xl font-bold"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === history.length - 1}
              className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded transition-colors w-12 h-12 flex items-center justify-center"
            >
              ▶
            </button>
            <button
              onClick={() => setCurrentIndex(history.length - 1)}
              disabled={currentIndex === history.length - 1}
              className="p-3 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
            >
              ⏭
            </button>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Status</div>
            <div className="text-lg">
              {currentState.turn === 'white' ? 'White to move' : 'Black to move'}
            </div>
            {gameInfo && currentIndex === history.length - 1 && (
              <div className="mt-2 text-[#D4FF00] font-bold">
                GAME OVER - {gameInfo.result === 'draw' ? 'DRAW' : gameInfo.result === 'white_win' ? 'WHITE WON' : 'BLACK WON'}
              </div>
            )}

            {/* Last Move info */}
            {lastMove && (
              <div className="mt-4 text-gray-500 text-sm font-mono">
                Last Move: {lastMove.uci}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
