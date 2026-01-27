import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGameReplay, getGameById } from '../services/gameApi'
import ChessBoard from '../components/ChessBoard'
import { useAuthStore } from '../stores/authStore'
import type { Game } from '../types/api.types'
import type { Move, Piece } from '../types/game'
import { EvalBar } from './GamePage'
import { socketService } from '../services/socket'

export default function ReplayPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [history, setHistory] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [gameInfo, setGameInfo] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [evalScore, setEvalScore] = useState<{ type: 'cp' | 'mate', value: number } | null>(null)
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

  // Auto-flip for black player
  useEffect(() => {
    if (gameInfo && user) {
      const isBlack = String((gameInfo.player2 as any).userId || gameInfo.player2.userId) === String(user.id)
      if (isBlack) setIsFlipped(true)
    }
  }, [gameInfo, user])

  // Detect if data is mirrored (White pieces in top half, Rank 8)
  const isDataMirrored = useMemo(() => {
    if (!history.length) return false

    // Check initial board placement
    const initialBoard = history[0].board as (Piece | null)[][]

    // Scan top 4 rows (Rank 8, 7, 6, 5 -> index 0, 1, 2, 3)
    // If we find White King here, it's definitely mirrored (or very weird strategy)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const p = initialBoard[r][c]
        if (p && p.type === 'k' && p.color === 'white') {
          console.log("🔄 Detected mirrored replay data (White King at top)")
          return true
        }
      }
    }
    return false
  }, [history])

  // Key controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === ' ') togglePlay()
      if (e.key === 'f') setIsFlipped(prev => !prev)
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
      }, 2000) // 2 seconds per move
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, history.length])

  // Analysis socket listener
  useEffect(() => {
    const socket = socketService.getSocket()
    if (!socket) return

    const handleAnalysis = (data: { type: 'cp' | 'mate', value: number }) => {
      setEvalScore(data)
    }

    socket.on('analysis-result', handleAnalysis)
    return () => {
      socket.off('analysis-result', handleAnalysis)
    }
  }, [])

  // Check for FEN and request analysis when index changes
  useEffect(() => {
    if (history[currentIndex]?.fen) {
      const socket = socketService.getSocket()
      if (socket) {
        socket.emit('analyze-fen', { fen: history[currentIndex].fen })
      }
    } else {
      setEvalScore(null)
    }
  }, [currentIndex, history])

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
      piece: 'p', // Dummy piece type
    } as Move
  }

  // Fix mirrored data for display
  let displayBoard = currentState.board
  let displayLastMove = lastMove

  if (isDataMirrored) {
    // Reverse board rows (Top <-> Bottom)
    displayBoard = [...displayBoard].reverse()

    // Reverse Move Ranks (1 <-> 8, 2 <-> 7, etc.)
    if (displayLastMove) {
      const flipUci = (uci: string) => {
        if (!uci || uci.length < 4) return uci
        const fromFile = uci[0]
        const fromRank = parseInt(uci[1])
        const toFile = uci[2]
        const toRank = parseInt(uci[3])
        const prom = uci.substring(4)

        const newFromRank = 9 - fromRank
        const newToRank = 9 - toRank
        return `${fromFile}${newFromRank}${toFile}${newToRank}${prom}`
      }
      displayLastMove = { ...displayLastMove, uci: flipUci(displayLastMove.uci) }
    }
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

        <div className="flex items-center gap-8">
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="text-xs border border-gray-600 rounded px-3 py-1 hover:bg-gray-800 transition-colors"
          >
            FLIP BOARD (F)
          </button>

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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6">

        {/* Helper Div for layout consistency with GamePage */}
        <div className="flex gap-4">
          <div className="h-[600px] pt-8 pb-8 shrink-0">
            <EvalBar evaluation={evalScore} />
          </div>
          <div className="relative">
            <ChessBoard
              board={displayBoard}
              currentTurn={currentState.turn}
              myColor={isFlipped ? 'black' : 'white'}
              isMyTurn={false}
              lastMove={displayLastMove}
              onMove={() => { }}
              isCheck={false} // TODO: Add check status to replay data
              useImages={true}
            />
          </div>
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
