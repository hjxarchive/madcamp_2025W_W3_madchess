import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllPieces } from '../services/pieceApi'
import { createDeck } from '../services/deckApi'
import { getUserDecks } from '../services/userApi'
import type { Piece, DeckPiece, DeckWithStats } from '../types/api.types'

const BUDGET_MAX = 30

export default function DeckBuilderPage() {
  const navigate = useNavigate()
  const userId = 1 // Hardcoded for demo

  // Dummy pieces as fallback
  const dummyPieces: Piece[] = [
    { id: 1, name: '킹', type: 'King', value: 0, action: 'move', maxCount: 1, description: '왕', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg' },
    { id: 2, name: '퀸', type: 'Queen', value: 9, action: 'move', maxCount: 1, description: '여왕', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg' },
    { id: 3, name: '룩', type: 'Rook', value: 5, action: 'move', maxCount: 2, description: '전차', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg' },
    { id: 4, name: '비숍', type: 'Bishop', value: 3, action: 'move', maxCount: 2, description: '주교', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg' },
    { id: 5, name: '나이트', type: 'Knight', value: 3, action: 'move', maxCount: 2, description: '기사', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg' },
    { id: 6, name: '폰', type: 'Pawn', value: 1, action: 'move', maxCount: 8, description: '졸', imgUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg' },
  ]

  const dummySavedDecks: DeckWithStats[] = [
    {
      id: 101,
      name: '공격형',
      userId: 1,
      pieces: [{ pieceId: 1, count: 1 }, { pieceId: 2, count: 1 }, { pieceId: 3, count: 2 }],
      totalCost: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      winCnt: 5,
      loseCnt: 3,
      winRate: 62.5,
    },
    {
      id: 102,
      name: '밸런스형',
      userId: 1,
      pieces: [{ pieceId: 1, count: 1 }, { pieceId: 4, count: 2 }, { pieceId: 5, count: 2 }],
      totalCost: 26,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      winCnt: 7,
      loseCnt: 2,
      winRate: 77.8,
    },
    {
      id: 103,
      name: '방어형',
      userId: 1,
      pieces: [{ pieceId: 1, count: 1 }, { pieceId: 3, count: 1 }, { pieceId: 5, count: 6 }],
      totalCost: 28,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      winCnt: 4,
      loseCnt: 1,
      winRate: 80.0,
    },
  ]

  const [pieces, setPieces] = useState<Piece[]>(dummyPieces)
  const [selectedPieces, setSelectedPieces] = useState<Record<number, number>>({ 1: 1 }) // King always 1
  const [deckName, setDeckName] = useState('')
  const [savedDecks, setSavedDecks] = useState<DeckWithStats[]>(dummySavedDecks)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getAllPieces()
        if (res?.success && res.data) setPieces(res.data)
      } catch (_) {
        // Use dummy
      }
      try {
        const decksRes = await getUserDecks(userId)
        if (decksRes?.success && decksRes.data) setSavedDecks(decksRes.data)
      } catch (_) {
        // Use dummy
      }
    })()
  }, [])

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
    if (pieceId === 1) return // Can't remove King
    if (current > 0) {
      setSelectedPieces({ ...selectedPieces, [pieceId]: current - 1 })
    }
  }

  const handleSaveDeck = async () => {
    if (!deckName.trim()) {
      alert('덱 이름을 입력하세요.')
      return
    }
    const deckPieces: DeckPiece[] = Object.entries(selectedPieces)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ pieceId: Number(id), count }))
    
    if (deckPieces.length === 0) {
      alert('최소 하나의 기물을 선택하세요.')
      return
    }

    setSaving(true)
    try {
      const res = await createDeck({
        userId,
        name: deckName,
        pieces: deckPieces,
      })
      if (res?.success && res.data) {
        alert('덱이 저장되었습니다!')
        setDeckName('')
        // Refresh saved decks
        const decksRes = await getUserDecks(userId)
        if (decksRes?.success && decksRes.data) setSavedDecks(decksRes.data)
      }
    } catch (err) {
      alert('덱 저장 실패 (백엔드 연결 필요)')
    } finally {
      setSaving(false)
    }
  }

  const budgetPercentage = Math.min((currentBudget / BUDGET_MAX) * 100, 100)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
            <span>←</span>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 grid place-items-center rounded-sm bg-blue-500 text-white font-black text-xs">📦</div>
              <span className="font-semibold">Mad Chess 덱 빌더</span>
            </div>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Budget Section */}
        <section className="rounded-xl border border-gray-800 bg-slate-800/40 p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">단위 예산 (Budget)</div>
              <div className="text-2xl font-bold">
                {currentBudget} / {BUDGET_MAX} pts
              </div>
            </div>
            <div className="text-sm text-blue-400">
              남은 포인트: {budgetRemaining}
            </div>
          </div>
          <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${budgetPercentage}%` }}
            ></div>
          </div>
        </section>

        {/* Piece Selection */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">기물 선택 (Piece Selection)</h2>
            <div className="text-xs text-slate-400">최대 개수 배치 가능</div>
          </div>
          <div className="space-y-3">
            {pieces.map((piece) => {
              const count = selectedPieces[piece.id] || 0
              const isKing = piece.type === 'King'
              return (
                <div
                  key={piece.id}
                  className="flex items-center justify-between rounded-xl border border-gray-800 bg-slate-800/40 px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 grid place-items-center rounded-lg bg-slate-700 p-1">
                      <img src={piece.imgUrl} alt={piece.name} className="w-full h-full" />
                    </div>
                    <div>
                      <div className="font-semibold">{piece.name} ({piece.type})</div>
                      <div className="text-xs text-slate-400">{piece.value}pt</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {isKing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400">필수</span>
                        <span className="h-5 w-5 grid place-items-center rounded-full bg-emerald-600 text-white text-xs">✓</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecrement(piece.id)}
                          className="h-8 w-8 grid place-items-center rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={count === 0}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-semibold">{count}</span>
                        <button
                          onClick={() => handleIncrement(piece.id, piece.maxCount)}
                          className="h-8 w-8 grid place-items-center rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={count >= piece.maxCount || currentBudget + piece.value > BUDGET_MAX}
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
        </section>

        {/* Deck Name Input & Actions */}
        <section className="mt-6 rounded-xl border border-gray-800 bg-slate-800/40 p-6">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">덱 이름 (Deck Name)</div>
          <input
            type="text"
            placeholder="나의 공격적인 덱"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-gray-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSaveDeck}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>💾</span> 덱 저장
            </button>
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
              <span>📤</span> 공유
            </button>
          </div>
        </section>

        {/* Saved Decks */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">저장된 덱 (Saved Decks)</h2>
            <button className="text-xs text-blue-400 hover:underline">모두 보기</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {savedDecks.map((deck) => {
              const tagColor = deck.name.includes('공격') ? 'bg-red-900/60 text-red-200' : deck.name.includes('밸런스') ? 'bg-teal-900/60 text-teal-200' : 'bg-cyan-900/60 text-cyan-200'
              const tagLabel = deck.name.includes('공격') ? 'Aggro' : deck.name.includes('밸런스') ? 'Mid' : 'Def'
              return (
                <div key={deck.id} className="rounded-xl border border-gray-800 bg-slate-800/40 p-5 hover:bg-slate-800/60 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{deck.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${tagColor}`}>{tagLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                    <span>♔ x{deck.pieces.reduce((s, p) => s + p.count, 0)}</span>
                    <span>♕ x{deck.pieces.find((p) => p.pieceId === 2)?.count || 0}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
                    <span>승 {deck.winCnt}</span>
                    <span>패 {deck.loseCnt}</span>
                  </div>
                  <div className="relative h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-blue-500"
                      style={{ width: `${(deck.totalCost / BUDGET_MAX) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">총 {deck.totalCost}/{BUDGET_MAX} pts</div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t border-gray-800">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-400 text-center">
          © 2024 Mad chess 스튜디오. 모든 권리 보유.
        </div>
      </footer>
    </div>
  )
}
