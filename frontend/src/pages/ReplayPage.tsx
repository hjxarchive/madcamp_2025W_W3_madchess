import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
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

  interface AnalysisLine {
    id: number
    type: 'cp' | 'mate'
    value: number
    pv: string
  }

  const [history, setHistory] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [gameInfo, setGameInfo] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [analysisLines, setAnalysisLines] = useState<AnalysisLine[]>([])
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
    const socket = socketService.connect() // Connect if not connected

    const handleAnalysis = (data: AnalysisLine[] | { type: 'cp' | 'mate', value: number }) => {
      if (Array.isArray(data)) {
        setAnalysisLines(data)
      } else {
        // Fallback for single object (legacy)
        setAnalysisLines([{ id: 1, type: data.type, value: data.value, pv: '' }])
      }
    }

    socket.on('analysis-result', handleAnalysis)
    return () => {
      socket.off('analysis-result', handleAnalysis)
    }
  }, [])

  // Check for FEN and request analysis when index changes
  useEffect(() => {
    console.log('Current History Item:', history[currentIndex])
    if (history[currentIndex]?.fen) {
      const socket = socketService.getSocket()
      if (socket) {
        socket.emit('analyze-fen', { fen: history[currentIndex].fen })
      }
    } else {
      setAnalysisLines([])
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

  // PGN parsing logic (Copied from GamePage for consistency)
  const parseMoves = useMemo(() => {
    return (pgn: string) => {
      if (!pgn) return []

      const movedList: { move: number; white: string; black?: string }[] = []

      try {
        let cleanPgn = pgn
          .replace(/\d+\./g, '')
          .replace(/1-0|0-1|1\/2-1\/2/g, '')

        // Recursively remove bracketed/braced content to handle nesting [[...]] or {{...}}
        // Also specific fix for User's reported "||" artifact or JSON residue
        let prev = ''
        while (cleanPgn !== prev) {
          prev = cleanPgn
          cleanPgn = cleanPgn
            .replace(/\[[^[\]]*?\]/g, '') // Remove innermost []
            .replace(/\{[^\{\}]*?\}/g, '') // Remove innermost {}
        }

        cleanPgn = cleanPgn.replace(/[|"]/g, '').trim() // Remove pipes and quotes

        if (!cleanPgn) return []

        const tokens = cleanPgn.split(/\s+/).filter(t => t && t.length > 1) // Filter empty or single-char noise

        let chess: Chess | null = null
        try {
          // Sanitize FEN
          // Prioritize history[0].fen (Actual Replay Start) over gameInfo.initialFen (Metadata which might be default Standard FEN)
          const fallbackFen = history[0]?.fen
          const gameInfoFen = (gameInfo as any)?.initialFen
          console.log('DEBUG: parseMoves - gameInfoFen:', gameInfoFen, 'fallbackFen:', fallbackFen)

          let fenToUse = fallbackFen || gameInfoFen
          if (fenToUse) {
            const parts = fenToUse.split(' ')
            if (parts.length >= 3) {
              let castling = parts[2].replace(/[^KQkq-]/g, '')
              if (!castling) castling = '-'
              parts[2] = castling

              const boardStr = parts[0]
              const rows = boardStr.split('/')
              if (rows.length === 8) {
                rows[0] = rows[0].replace(/[pP]/g, '1')
                rows[7] = rows[7].replace(/[pP]/g, '1')
                // Normalize rows: Collapse adjacent numbers
                const collapseNumbers = (row: string) => {
                  let newRow = row
                  while (/\d\d/.test(newRow)) {
                    newRow = newRow.replace(/(\d)(\d)/g, (_, d1, d2) => (parseInt(d1) + parseInt(d2)).toString())
                  }
                  return newRow
                }
                rows[0] = collapseNumbers(rows[0])
                rows[7] = collapseNumbers(rows[7])
                parts[0] = rows.join('/')
              }
              fenToUse = parts.join(' ')
            }
          }
          chess = new Chess(fenToUse || undefined)
        } catch (e) {
          try { chess = new Chess() } catch (err) { chess = null }
        }

        let currentMoveNum = 1
        let currentPair: { move: number; white: string; black?: string } = { move: 1, white: '' }

        tokens.forEach((token, index) => {
          let san = token
          if (chess) {
            try {
              const from = token.substring(0, 2)
              const to = token.substring(2, 4)
              const promotion = token.length > 4 ? token.substring(4, 5) : undefined
              const result = chess!.move({ from, to, promotion: promotion as any })
              if (result) san = result.san
            } catch (e) { }
          }

          if (index % 2 === 0) {
            currentPair = { move: currentMoveNum, white: san }
          } else {
            currentPair.black = san
            movedList.push(currentPair)
            currentMoveNum++
          }
        })
        if (tokens.length % 2 !== 0) movedList.push(currentPair)

      } catch (e) {
        // Fallback
        try {
          const clean = pgn.replace(/\d+\./g, '').replace(/1-0|0-1|1\/2-1\/2/g, '').trim()
          const list = clean.split(/\s+/).filter(t => t)
          let mv = 1
          let pair: any = { move: 1, white: '' }
          list.forEach((t, i) => {
            if (i % 2 === 0) pair = { move: mv, white: t }
            else { pair.black = t; movedList.push(pair); mv++ }
          })
          if (list.length % 2 !== 0) movedList.push(pair)
        } catch (err) { return [] }
      }
      return movedList
    }
  }, [(gameInfo as any)?.initialFen, history])

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

  // Dynamic orientation detection
  // Standard (FEN): Rank 8 at Index 0 (Black pieces). Rank 1 at Index 7 (White pieces).
  // Inverted (ChessService): Rank 1 at Index 0 (White pieces). Rank 8 at Index 7 (Black pieces).
  const isBoardInverted = (currentState.board[0] as (Piece | null)[]).some(p => p && p.color === 'white') ||
    (currentState.board[7] as (Piece | null)[]).some(p => p && p.color === 'black')

  const displayBoard = isBoardInverted ? [...currentState.board].reverse() : currentState.board
  const displayLastMove = lastMove

  // Debug Info
  const debugInfo = isBoardInverted ? 'Orientation: INVERTED (Fixed)' : 'Orientation: STANDARD'

  if (isFlipped) {
    // ...
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#050505]/90 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/mypage')} className="text-gray-500 hover:text-white transition-colors">
            ← BACK
          </button>
          <div className="font-serif text-lg flex flex-col">
            <div><span className="text-[#D4FF00]">REPLAY</span> MODE</div>
            {/* Debug info removed */}
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

        {/* Center: Chess Board */}
        <div className="flex gap-4 justify-center items-start">
          <div className="h-[600px] shrink-0 pt-8 pb-8 flex flex-col items-center gap-4">
            {/* Engine Lines */}
            {/* Engine Analysis moved to right column */}

            <EvalBar evaluation={analysisLines.length > 0 ? { type: analysisLines[0].type, value: analysisLines[0].value } : null} />
          </div>
          <div className="flex flex-col items-center">
            <ChessBoard
              key={`${isFlipped ? 'black' : 'white'}-${currentIndex}`}
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
        <div className="bg-[#0A0A0A] border border-gray-800 p-6 w-full max-w-sm flex flex-col gap-6">
          {/* Engine Analysis */}
          <div className="flex flex-col gap-2 w-full bg-[#0A0A0A]/80 backdrop-blur rounded p-2 text-xs font-mono border border-gray-800">
            <div className="text-gray-500 uppercase tracking-widest text-[10px] mb-1">Engine Analysis</div>
            {analysisLines.length > 0 ? (
              analysisLines.map((line) => (
                <div key={line.id} className="flex flex-col gap-0.5 border-b border-gray-800 last:border-0 pb-1 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#D4FF00]">
                      {line.type === 'mate' ? `M${Math.abs(line.value)}` :
                        (line.value > 0 ? `+${(line.value / 100).toFixed(1)}` : (line.value / 100).toFixed(1))}
                    </span>
                    <span className="text-gray-600">Depth 19</span>
                  </div>
                  <div className="text-gray-400 truncate" title={line.pv}>
                    {line.pv || 'Thinking...'}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-600 italic">Analysis loading...</div>
            )}
          </div>

          <div className="border-t border-gray-800 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Label */}
              <div className="text-gray-500 text-xs uppercase tracking-widest shrink-0">Move</div>

              {/* Center: Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded transition-colors w-10 h-10 flex items-center justify-center font-bold text-white text-sm"
                >
                  ◀
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2 bg-[#D4FF00] text-black hover:bg-white rounded transition-colors w-12 h-12 flex items-center justify-center text-xl font-bold"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === history.length - 1}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded transition-colors w-10 h-10 flex items-center justify-center font-bold text-white text-sm"
                >
                  ▶
                </button>
              </div>

              {/* Right: Counter */}
              <div className="text-xl font-mono text-[#D4FF00] shrink-0">
                {currentIndex} <span className="text-gray-600 text-base">/ {history.length - 1}</span>
              </div>
            </div>

            {/* Move History List */}
            <div className="border-t border-gray-800 pt-4 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-widest text-[#D4FF00] font-bold">Move History</h3>
                <span className="text-xs text-gray-500">{history.length - 1} moves</span>
              </div>
              <div className="overflow-y-auto space-y-0.5 font-mono text-sm max-h-60 pr-1 custom-scrollbar">
                {parseMoves(gameInfo?.pgn || '').map((m, idx) => {
                  const whiteMoveIndex = idx * 2 + 1
                  const blackMoveIndex = idx * 2 + 2

                  // Highlight check
                  const isWhiteActive = currentIndex === whiteMoveIndex
                  const isBlackActive = currentIndex === blackMoveIndex

                  return (
                    <div key={idx} className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-2 py-1 hover:bg-gray-900/50 rounded">
                      <span className="text-gray-600">{m.move}.</span>
                      <span
                        className={`cursor-pointer transition-colors ${isWhiteActive ? 'text-[#D4FF00] font-bold bg-[#D4FF00]/10 rounded px-1 -mx-1' : 'text-gray-300 hover:text-white'}`}
                        onClick={() => setCurrentIndex(whiteMoveIndex)}
                      >
                        {m.white}
                      </span>
                      <span
                        className={`cursor-pointer transition-colors ${isBlackActive ? 'text-[#D4FF00] font-bold bg-[#D4FF00]/10 rounded px-1 -mx-1' : 'text-gray-300 hover:text-white'}`}
                        onClick={() => { if (m.black) setCurrentIndex(blackMoveIndex) }}
                      >
                        {m.black}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
