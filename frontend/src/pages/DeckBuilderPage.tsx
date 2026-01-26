import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllPieces } from '../services/pieceApi'
import { createDeck } from '../services/deckApi'
import { getUserDecks } from '../services/userApi'
import { useAuthStore } from '../stores/authStore'
import type { DeckWithStats } from '../types/api.types'

// Types
type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
type Rank = 1 | 2 | 3 | 4

interface PlacedPiece {
  type: PieceType
  file: File
  rank: Rank
}

const BUDGET_MAX = 30
const FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS: Rank[] = [1, 2, 3, 4]

const PIECE_COSTS: Record<PieceType, number> = {
  k: 0, q: 9, r: 5, b: 3, n: 3, p: 1
}

const PIECE_MAX_COUNT: Record<PieceType, number> = {
  k: 1, q: 1, r: 2, b: 2, n: 2, p: 8
}

const PIECE_NAMES: Record<PieceType, string> = {
  k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn'
}

const PIECE_IMAGES: Record<PieceType, string> = {
  k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
}

export default function DeckBuilderPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([
    { type: 'k', file: 'e', rank: 1 } // King is always at e1
  ])
  const [selectedPieceType, setSelectedPieceType] = useState<PieceType | null>(null)
  const [hoverSquare, setHoverSquare] = useState<{ file: File; rank: Rank } | null>(null)
  const [deckName, setDeckName] = useState('')
  const [savedDecks, setSavedDecks] = useState<DeckWithStats[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load saved decks
  useEffect(() => {
    if (user?.id) {
      getUserDecks(user.id).then(res => {
        if (res?.success && res.data) setSavedDecks(res.data)
      }).catch(() => { })
    }
  }, [user])

  // Calculate budget
  const usedBudget = placedPieces.reduce((sum, p) => sum + PIECE_COSTS[p.type], 0)
  const budgetRemaining = BUDGET_MAX - usedBudget

  // Get available pieces (not maxed out)
  const getAvailablePieces = () => {
    const pieceTypes: PieceType[] = ['q', 'r', 'b', 'n', 'p'] // King is always placed
    return pieceTypes.map(type => {
      const placedCount = placedPieces.filter(p => p.type === type).length
      const remaining = PIECE_MAX_COUNT[type] - placedCount
      return { type, remaining, cost: PIECE_COSTS[type] }
    }).filter(p => p.remaining > 0)
  }

  // Handle piece selection
  const handlePieceSelect = (type: PieceType) => {
    if (selectedPieceType === type) {
      setSelectedPieceType(null)
    } else {
      // Check if can afford
      if (usedBudget + PIECE_COSTS[type] > BUDGET_MAX) {
        setError(`Not enough budget for ${PIECE_NAMES[type]}`)
        return
      }
      setSelectedPieceType(type)
      setError('')
    }
  }

  // Handle board square click
  const handleSquareClick = (file: File, rank: Rank) => {
    const existingPiece = placedPieces.find(p => p.file === file && p.rank === rank)

    // If clicking on existing piece, remove it (except King)
    if (existingPiece) {
      if (existingPiece.type === 'k') {
        setError("King cannot be removed")
        return
      }
      setPlacedPieces(prev => prev.filter(p => !(p.file === file && p.rank === rank)))
      setSelectedPieceType(existingPiece.type) // Auto-select removed piece
      setError('')
      return
    }

    // If no piece selected, do nothing
    if (!selectedPieceType) return

    // King can only be at e1
    if (file === 'e' && rank === 1) {
      setError("King's position is fixed at e1")
      return
    }

    // Check budget
    if (usedBudget + PIECE_COSTS[selectedPieceType] > BUDGET_MAX) {
      setError("Budget exceeded!")
      return
    }

    // Place the piece
    setPlacedPieces(prev => [...prev, { type: selectedPieceType, file, rank }])
    setSelectedPieceType(null)
    setError('')
  }

  // Build composition from placed pieces
  const buildComposition = (): { [key: string]: number } => {
    const composition: { [key: string]: number } = {}
    placedPieces.forEach(p => {
      composition[p.type] = (composition[p.type] || 0) + 1
    })
    return composition
  }

  // Save deck
  const handleSaveDeck = async () => {
    if (!isAuthenticated || !user) {
      setError('Please login to save a deck')
      return
    }
    if (!deckName.trim()) {
      setError('Enter a deck name')
      return
    }
    if (placedPieces.length < 2) {
      setError('Place at least one piece besides the King')
      return
    }

    setSaving(true)
    setError('')
    try {
      const composition = buildComposition()
      const res = await createDeck({
        userId: user.id,
        name: deckName,
        composition,
      })
      if (res?.success) {
        setDeckName('')
        // Refresh saved decks
        const decksRes = await getUserDecks(user.id)
        if (decksRes?.success && decksRes.data) setSavedDecks(decksRes.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save deck')
    } finally {
      setSaving(false)
    }
  }

  // Reset board
  const handleReset = () => {
    setPlacedPieces([{ type: 'k', file: 'e', rank: 1 }])
    setSelectedPieceType(null)
    setError('')
  }

  const availablePieces = getAvailablePieces()

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-900 bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="group flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
            <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
            <span className="uppercase tracking-widest text-xs font-bold">Back to Arena</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-white skew-x-12"></div>
            <div className="font-serif text-lg">
              <span className="text-[#D4FF00]">DECK</span>
              <span className="text-white">BUILDER</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left: Board */}
          <div>
            {/* Budget Bar */}
            <div className="mb-6 p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-widest">Budget</div>
                <div className={`font-mono text-lg ${budgetRemaining < 5 ? 'text-red-500' : 'text-[#D4FF00]'}`}>
                  {budgetRemaining} pts remaining
                </div>
              </div>
              <div className="relative h-2 bg-gray-900">
                <div
                  className={`absolute h-full transition-all ${usedBudget >= BUDGET_MAX ? 'bg-red-500' : 'bg-[#D4FF00]'}`}
                  style={{ width: `${(usedBudget / BUDGET_MAX) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-right text-2xl font-serif">
                <span className="text-white">{usedBudget}</span>
                <span className="text-gray-600"> / {BUDGET_MAX}</span>
              </div>
            </div>

            {/* Chess Board (4 ranks) */}
            <div className="inline-block border-2 border-gray-800">
              {[...RANKS].reverse().map(rank => (
                <div key={rank} className="flex">
                  {/* Rank label */}
                  <div className="w-8 flex items-center justify-center text-gray-600 text-sm font-mono">
                    {rank}
                  </div>
                  {FILES.map(file => {
                    const isLight = (FILES.indexOf(file) + rank) % 2 === 1
                    const piece = placedPieces.find(p => p.file === file && p.rank === rank)
                    const isKingSquare = file === 'e' && rank === 1
                    const isHovered = hoverSquare?.file === file && hoverSquare?.rank === rank
                    const canPlace = !piece && selectedPieceType && !(file === 'e' && rank === 1)

                    return (
                      <div
                        key={`${file}${rank}`}
                        onClick={() => handleSquareClick(file, rank)}
                        onMouseEnter={() => setHoverSquare({ file, rank })}
                        onMouseLeave={() => setHoverSquare(null)}
                        className={`
                          w-16 h-16 flex items-center justify-center relative cursor-pointer
                          transition-all duration-150
                          ${isLight ? 'bg-[#E8E4D9]' : 'bg-[#B7C0D8]'}
                          ${isKingSquare ? 'ring-2 ring-inset ring-[#D4FF00]' : ''}
                          ${isHovered && canPlace ? 'ring-2 ring-blue-400' : ''}
                          ${piece && piece.type !== 'k' ? 'hover:opacity-70' : ''}
                        `}
                      >
                        {/* Hover preview */}
                        {isHovered && canPlace && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-40">
                            <img src={PIECE_IMAGES[selectedPieceType]} alt="" className="w-12 h-12" />
                          </div>
                        )}
                        {/* Placed piece */}
                        {piece && (
                          <img
                            src={PIECE_IMAGES[piece.type]}
                            alt={PIECE_NAMES[piece.type]}
                            className="w-12 h-12"
                            draggable={false}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* File labels */}
              <div className="flex">
                <div className="w-8" />
                {FILES.map(file => (
                  <div key={file} className="w-16 text-center text-gray-600 text-sm font-mono py-1">
                    {file}
                  </div>
                ))}
              </div>
            </div>

            {/* Reset button */}
            <button
              onClick={handleReset}
              className="mt-4 px-6 py-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 uppercase tracking-widest text-xs font-bold transition-colors"
            >
              ↺ Reset Board
            </button>
          </div>

          {/* Right: Controls */}
          <div className="space-y-6">
            {/* Available Pieces */}
            <div className="border border-gray-800 p-4">
              <h2 className="text-lg font-serif mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#D4FF00]"></span>
                Available Pieces
              </h2>
              <div className="text-xs text-gray-500 mb-4">Click a piece, then click the board to place</div>
              <div className="grid grid-cols-2 gap-3">
                {availablePieces.map(({ type, remaining, cost }) => {
                  const isSelected = selectedPieceType === type
                  const canAfford = usedBudget + cost <= BUDGET_MAX
                  return (
                    <button
                      key={type}
                      onClick={() => handlePieceSelect(type)}
                      disabled={!canAfford}
                      className={`
                        p-3 border transition-all flex flex-col items-center
                        ${isSelected ? 'border-[#D4FF00] bg-[#D4FF00]/10' : 'border-gray-800 hover:border-gray-600'}
                        ${!canAfford ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <img src={PIECE_IMAGES[type]} alt={PIECE_NAMES[type]} className="w-10 h-10 mb-2" />
                      <div className="text-sm font-serif">{PIECE_NAMES[type]}</div>
                      <div className="text-xs text-gray-500">{cost}pt × {remaining}</div>
                    </button>
                  )
                })}
              </div>
              {availablePieces.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-4">All pieces placed!</div>
              )}
            </div>

            {/* Save Deck */}
            <div className="border border-gray-800 p-4">
              <h2 className="text-lg font-serif mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#D4FF00]"></span>
                Save Deck
              </h2>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Deck Name"
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 text-white placeholder-gray-600 focus:border-[#D4FF00] focus:outline-none transition-colors mb-3"
              />
              {error && (
                <div className="text-red-500 text-sm mb-3 py-2 px-3 border border-red-900 bg-red-900/10">
                  {error}
                </div>
              )}
              <button
                onClick={handleSaveDeck}
                disabled={saving || !isAuthenticated}
                className={`w-full py-3 font-bold uppercase tracking-widest text-sm transition-all ${saving || !isAuthenticated
                    ? 'bg-gray-900 text-gray-600 cursor-not-allowed'
                    : 'bg-[#D4FF00] text-black hover:bg-white'
                  }`}
              >
                {saving ? 'Saving...' : 'Save Deck'}
              </button>
            </div>

            {/* Saved Decks */}
            {savedDecks.length > 0 && (
              <div className="border border-gray-800 p-4">
                <h3 className="text-sm font-serif text-gray-400 mb-3">Your Decks</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedDecks.map(deck => (
                    <div key={deck.id} className="p-3 border border-gray-800 hover:border-[#D4FF00] transition-colors cursor-pointer">
                      <div className="font-serif">{deck.name}</div>
                      <div className="text-xs text-gray-500">{deck.totalCost} pts</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
