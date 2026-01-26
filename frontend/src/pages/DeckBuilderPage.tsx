import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllPieces } from '../services/pieceApi'
import { createDeck } from '../services/deckApi'
import { getUserDecks } from '../services/userApi'
import { useAuthStore } from '../stores/authStore'
import type { Piece, DeckPiece, DeckWithStats } from '../types/api.types'

const BUDGET_MAX = 30

export default function DeckBuilderPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  // Dummy pieces as fallback
  const dummyPieces: Piece[] = [
    { id: 1, name: 'King', type: 'King', value: 0, action: 'k', maxCount: 1, description: '왕', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg' },
    { id: 2, name: 'Queen', type: 'Queen', value: 9, action: 'q', maxCount: 1, description: '여왕', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg' },
    { id: 3, name: 'Rook', type: 'Rook', value: 5, action: 'r', maxCount: 2, description: '전차', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg' },
    { id: 4, name: 'Bishop', type: 'Bishop', value: 3, action: 'b', maxCount: 2, description: '주교', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg' },
    { id: 5, name: 'Knight', type: 'Knight', value: 3, action: 'n', maxCount: 2, description: '기사', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg' },
    { id: 6, name: 'Pawn', type: 'Pawn', value: 1, action: 'p', maxCount: 8, description: '졸', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg' },
  ]

  const [pieces, setPieces] = useState<Piece[]>(dummyPieces)
  const [selectedPieces, setSelectedPieces] = useState<Record<number, number>>({ 1: 1 }) // King always 1
  const [deckName, setDeckName] = useState('')
  const [savedDecks, setSavedDecks] = useState<DeckWithStats[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ; (async () => {
      try {
        const res = await getAllPieces()
        if (res?.success && res.data) setPieces(res.data)
      } catch (_) {
        // Use dummy
      }
      if (user?.id) {
        try {
          const decksRes = await getUserDecks(user.id)
          if (decksRes?.success && decksRes.data) setSavedDecks(decksRes.data)
        } catch (_) {
          // Use dummy
        }
      }
    })()
  }, [user])

  const currentBudget = pieces.reduce((sum, p) => {
    const count = selectedPieces[p.id] || 0
    return sum + p.value * count
  }, 0)

  const budgetRemaining = BUDGET_MAX - currentBudget

  const handleIncrement = (pieceId: number, maxCount: number) => {
    const current = selectedPieces[pieceId] || 0
    if (current < maxCount) {
      const piece = pieces.find((p) => p.id === pieceId)
      if (piece && currentBudget + piece.value <= BUDGET_MAX) {
        setSelectedPieces({ ...selectedPieces, [pieceId]: current + 1 })
      }
    }
  }

  const handleDecrement = (pieceId: number) => {
    const current = selectedPieces[pieceId] || 0
    const piece = pieces.find((p) => p.id === pieceId)
    if (piece?.action?.toLowerCase() === 'k') return // Can't remove King
    if (current > 0) {
      setSelectedPieces({ ...selectedPieces, [pieceId]: current - 1 })
    }
  }

  const handleSaveDeck = async () => {
    if (!isAuthenticated || !user) {
      setError('Please login to save a deck')
      return
    }
    if (!deckName.trim()) {
      setError('Enter a deck name')
      return
    }

    // Build composition in the format backend expects: { "p": 8, "k": 1, ... }
    const composition: { [key: string]: number } = {}
    Object.entries(selectedPieces).forEach(([pieceIdStr, count]) => {
      if (count > 0) {
        const piece = pieces.find((p) => p.id === Number(pieceIdStr))
        if (piece?.action) {
          composition[piece.action.toLowerCase()] = count
        }
      }
    })

    if (Object.keys(composition).length === 0) {
      setError('Select at least one piece')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await createDeck({
        userId: user.id,
        name: deckName,
        composition,
      })
      if (res?.success && res.data) {
        setDeckName('')
        setSelectedPieces({ 1: 1 }) // Reset to just King
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

  const budgetPercentage = Math.min((currentBudget / BUDGET_MAX) * 100, 100)

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-900 bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Budget Section */}
        <section className="border border-gray-800 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Budget</div>
              <div className="text-4xl font-serif font-light">
                <span className="text-white">{currentBudget}</span>
                <span className="text-gray-600"> / {BUDGET_MAX}</span>
              </div>
            </div>
            <div className={`text-2xl font-mono ${budgetRemaining < 5 ? 'text-red-500' : 'text-[#D4FF00]'}`}>
              {budgetRemaining} pts remaining
            </div>
          </div>
          <div className="relative h-2 bg-gray-900 overflow-hidden">
            <div
              className={`absolute h-full transition-all duration-300 ${budgetPercentage >= 100 ? 'bg-red-500' : 'bg-[#D4FF00]'}`}
              style={{ width: `${budgetPercentage}%` }}
            ></div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Piece Selection */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-serif mb-6 flex items-center gap-4">
              <span className="w-2 h-2 bg-[#D4FF00]"></span>
              Piece Selection
            </h2>
            <div className="space-y-4">
              {pieces.map((piece) => {
                const count = selectedPieces[piece.id] || 0
                const isKing = piece.action?.toLowerCase() === 'k'
                const canAdd = count < piece.maxCount && currentBudget + piece.value <= BUDGET_MAX
                return (
                  <div
                    key={piece.id}
                    className="flex items-center justify-between border border-gray-800 hover:border-gray-700 p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-900 p-2 border border-gray-800">
                        <img src={piece.imgUrl} alt={piece.name} className="w-full h-full" />
                      </div>
                      <div>
                        <div className="font-serif text-lg">{piece.name}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest">{piece.value} pts • max {piece.maxCount}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isKing ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#D4FF00] uppercase tracking-widest">Required</span>
                          <span className="w-8 h-8 flex items-center justify-center border border-[#D4FF00] text-[#D4FF00]">✓</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrement(piece.id)}
                            className="w-10 h-10 flex items-center justify-center border border-gray-800 text-gray-500 hover:border-[#D4FF00] hover:text-[#D4FF00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={count === 0}
                          >
                            −
                          </button>
                          <span className="w-12 text-center font-mono text-xl">{count}</span>
                          <button
                            onClick={() => handleIncrement(piece.id, piece.maxCount)}
                            className="w-10 h-10 flex items-center justify-center border border-gray-800 text-gray-500 hover:border-[#D4FF00] hover:text-[#D4FF00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={!canAdd}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Deck Name & Save */}
          <div>
            <h2 className="text-2xl font-serif mb-6 flex items-center gap-4">
              <span className="w-2 h-2 bg-[#D4FF00]"></span>
              Save Deck
            </h2>
            <div className="border border-gray-800 p-6">
              <div className="mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Deck Name</div>
                <input
                  type="text"
                  placeholder="My Aggressive Deck"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 text-white placeholder-gray-600 focus:border-[#D4FF00] focus:outline-none transition-colors"
                />
              </div>
              {error && (
                <div className="text-red-500 text-sm mb-4 py-2 px-3 border border-red-900 bg-red-900/10">
                  {error}
                </div>
              )}
              <button
                onClick={handleSaveDeck}
                disabled={saving || !isAuthenticated}
                className={`w-full py-4 font-bold uppercase tracking-widest text-sm transition-all ${saving || !isAuthenticated
                    ? 'bg-gray-900 text-gray-600 cursor-not-allowed'
                    : 'bg-[#D4FF00] text-black hover:bg-white'
                  }`}
              >
                {saving ? 'Saving...' : isAuthenticated ? 'Save Deck' : 'Login to Save'}
              </button>
            </div>

            {/* Saved Decks */}
            {savedDecks.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-serif mb-4 text-gray-400">Your Decks</h3>
                <div className="space-y-3">
                  {savedDecks.map((deck) => (
                    <div key={deck.id} className="border border-gray-800 p-4 hover:border-[#D4FF00] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-serif">{deck.name}</div>
                        <div className="text-xs text-gray-500">{deck.totalCost} pts</div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="text-[#D4FF00]">{deck.winCnt}W</span>
                        <span className="text-gray-500">{deck.loseCnt}L</span>
                        <span>{Math.round((deck.winRate || 0) * 100)}%</span>
                      </div>
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
