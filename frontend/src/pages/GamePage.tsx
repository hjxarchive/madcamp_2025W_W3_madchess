import { useParams } from 'react-router-dom'
import React, { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import ChessBoard from '../components/ChessBoard'
import { Move, Piece, PlacedPiece, PieceColor, squareToRowCol, PieceType, rowColToSquare, squareToUci } from '../types/game'
import { socketService } from '../services/socket'

// 기물 이미지 URL
const PIECE_IMAGES: Record<PieceColor, Record<PieceType, string>> = {
  white: {
    k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  },
  black: {
    k: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
    q: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    r: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    b: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    n: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    p: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
  },
}

function CapturedBar({
  pieces,
  pieceColor,
  label,
}: {
  pieces: PieceType[]
  pieceColor: PieceColor
  label: string
}) {
  return (
    <div className="mt-2 w-full rounded-full bg-emerald-900/40 border border-emerald-700/50 px-3 py-2 flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200/90">
        {label}
      </span>
      <div className="flex items-center gap-2 overflow-x-auto">
        {pieces.length === 0 ? (
          <span className="text-xs text-emerald-200/60">없음</span>
        ) : (
          pieces.map((piece, idx) => (
            <div
              key={`${piece}-${idx}`}
              className="w-8 h-8 rounded-full bg-white/10 grid place-items-center shrink-0"
            >
              <img
                src={PIECE_IMAGES[pieceColor][piece]}
                alt={piece}
                className="w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { gameState, setGameState, makeMove, applyOpponentMove, rollbackMove } = useGameStore()
  const [useImages, setUseImages] = useState(true)
  const [myColor, setMyColor] = useState<PieceColor>('white')
  const [isCheck, setIsCheck] = useState(false)
  const [isCheckmate, setIsCheckmate] = useState(false)
  const [gameOverData, setGameOverData] = useState<{ winner: string; reason: string } | null>(null)
  const [showPromotion, setShowPromotion] = useState(false)
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  
  // 타이머 상태 (초 단위)
  const [myTime, setMyTime] = useState(10 * 60) // 10분
  const [opponentTime, setOpponentTime] = useState(10 * 60) // 10분
  
  // 잡힌 기물 추적
  const [myCapturedPieces, setMyCapturedPieces] = useState<PieceType[]>([]) // 내가 잡은 기물
  const [opponentCapturedPieces, setOpponentCapturedPieces] = useState<PieceType[]>([]) // 상대가 잡은 기물
  const [previousBoard, setPreviousBoard] = useState<(Piece | null)[][]>([]) // 이전 보드 상태
  const [serverLegalMoves, setServerLegalMoves] = useState<Array<{ from: string; to: string; promotion?: string }>>([])
  const [hasLegalMovesResponse, setHasLegalMovesResponse] = useState(false)
  const [lastMoverColor, setLastMoverColor] = useState<PieceColor | null>(null)

  // Ref for myColor to access in socket callbacks without closure issues
  const myColorRef = useRef<PieceColor>(myColor)
  useEffect(() => {
    myColorRef.current = myColor
  }, [myColor])

  // 개발 모드에서 전역 접근을 위해 window에 노출
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).testMove = (uci: string, piece: string, captured?: string) => {
        applyOpponentMove({ uci, piece: piece as any, captured: captured as any })
      }
      console.log('🎮 테스트 함수 사용 가능: testMove("e2e4", "p")')
    }
    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).testMove
      }
    }
  }, [applyOpponentMove])

  // sessionStorage에서 배치 정보 로드
  useEffect(() => {
    const savedColor = sessionStorage.getItem('myColor') as PieceColor | null
    if (savedColor) {
      setMyColor(savedColor)
    }

    // 배치 정보가 있으면 보드 초기화
    const placedPiecesStr = sessionStorage.getItem('placedPieces')
    if (placedPiecesStr) {
      const placedPieces = JSON.parse(placedPiecesStr) as PlacedPiece[]

      // 보드에 배치된 기물 배치
      const newBoard = Array(8).fill(null).map(() => Array(8).fill(null))

      // 내 기물 배치
      placedPieces.forEach((piece) => {
        const { row, col } = squareToRowCol({ file: piece.file, rank: piece.rank })
        newBoard[row][col] = {
          type: piece.type,
          color: savedColor || myColor,
        }
      })

      // 상대 기물 배치
      const opponentPlacementStr = sessionStorage.getItem('opponentPlacement')
      if (opponentPlacementStr) {
        const opponentPlacement = JSON.parse(opponentPlacementStr) as PlacedPiece[]
        const opponentColor = (savedColor || myColor) === 'white' ? 'black' : 'white'

        opponentPlacement.forEach((piece) => {
          const { row, col } = squareToRowCol({ file: piece.file, rank: piece.rank })
          newBoard[row][col] = {
            type: piece.type,
            color: opponentColor,
          }
        })
      }

      // gameStore 업데이트

      setGameState({
        roomId: gameId || 'test-room',
        white: {
          userId: 'white-player',
          username: 'White Player',
          rating: 1500,
          deckId: 'deck-1',
          color: 'white',
        },
        black: {
          userId: 'black-player',
          username: 'Black Player',
          rating: 1500,
          deckId: 'deck-2',
          color: 'black',
        },
        board: newBoard,
        currentTurn: 'white',
        moveCount: 0,
        pgn: '',
        status: 'playing',
        isCheck: false,
        capturedPieces: {
          white: [],
          black: [],
        },
      })

      console.log('Loaded board:', newBoard)
      console.log('My color:', savedColor || myColor)

      // 사용한 데이터는 제거 (한 번만 사용)
      sessionStorage.removeItem('placedPieces')
      sessionStorage.removeItem('opponentPlacement')
      sessionStorage.removeItem('myColor')
    }
  }, [])

  // WebSocket 이벤트 리스너 설정 (한 번만 등록, 빈 배열)
  useEffect(() => {
    console.log('🔌 Setting up socket listeners (once)')

    // 서버에서 브로드캐스트된 수를 받았을 때
    const handleMoveMade = (data: any) => {
      console.log('📥 Received move-made from server:', data)

      const mySocketId = socketService.getSocket()?.id
      const iMoved = data.socketId === mySocketId
      const currentMyColor = myColorRef.current
      const opponentColor = currentMyColor === 'white' ? 'black' : 'white'

      // Update check status
      setIsCheck(data.isCheck || false)
      setIsCheckmate(data.isCheckmate || false)

      // Apply server-confirmed move
      applyOpponentMove(data.move)

      // 다음 턴 합법수 재요청을 위해 플래그 리셋
      setHasLegalMovesResponse(false)
      setServerLegalMoves([])

      // 체크메이트가 함께 전송된 경우 즉시 팝업 표시
      if (data.isCheckmate) {
        const winner = iMoved ? currentMyColor : opponentColor
        console.log('🏆 Checkmate detected in move-made! Winner:', winner, 'I moved:', iMoved)
        setGameOverData(prev => prev ? prev : { winner, reason: 'checkmate' })
      }

      // 내가 수를 둔 직후 상대가 체크 상태라면, 잠시 후 game-over 여부 확인
      // (서버 isCheckmate 누락 대비)
      if (iMoved && data.isCheck) {
        console.log('⏳ I made a check move, waiting for opponent mate confirmation...')
        setTimeout(() => {
          // gameOverData가 이미 설정되었으면 무시
          setGameOverData(prev => {
            if (prev) return prev
            // 아직 game-over가 안 왔으면 상대가 합법수가 없을 경우 서버에서 곧 올 것
            // 여기서는 로그만 남김 (상대 클라이언트의 backup detection이 작동)
            return prev
          })
        }, 2000)
      }
    }

    // Game over event - 서버에서 보내는 이벤트가 유일한 신뢰 소스
    const handleGameOver = (data: { winner: string; reason: string }) => {
      console.log('🎮 Game over event received:', data)
      // 서버가 보낸 winner를 그대로 사용 (중복 방지)
      setGameOverData(prev => {
        if (prev) return prev
        return data
      })
      if (data.reason === 'checkmate') {
        setIsCheckmate(true)
      }
    }

    // 이동 에러
    const handleMoveError = (data: { message: string }) => {
      console.error('Move error:', data.message)
      rollbackMove()
      setMoveError(data.message)
      setTimeout(() => setMoveError(null), 3000)
    }

    // 합법수 응답
    const handleLegalMoves = (data: { legalMoves: Array<{ from: string; to: string; promotion?: string }> }) => {
      setServerLegalMoves(data.legalMoves || [])
      setHasLegalMovesResponse(true)
    }

    const handleLegalMovesError = (data: { message: string }) => {
      console.error('Legal moves error:', data.message)
    }

    socketService.onMoveMade(handleMoveMade)
    socketService.onGameOver(handleGameOver)
    socketService.onMoveError(handleMoveError)
    socketService.onLegalMoves(handleLegalMoves)
    socketService.onLegalMovesError(handleLegalMovesError)

    // 정리
    return () => {
      socketService.offMoveMade()
      socketService.offGameOver()
      socketService.offMoveError()
      socketService.offLegalMoves()
      socketService.offLegalMovesError()
    }
  }, []) // 빈 배열: 한 번만 등록

  // 내 턴이 시작될 때 합법수 요청
  useEffect(() => {
    if (gameState && gameState.currentTurn === myColor && !gameOverData) {
      console.log('🎯 My turn started, requesting legal moves')
      setHasLegalMovesResponse(false)
      setServerLegalMoves([])
      socketService.requestLegalMoves(gameState.roomId)
    }
  }, [gameState?.currentTurn, gameState?.roomId, myColor, gameOverData])

  // 내 턴이 시작될 때 스테일메이트/체크메이트 백업 판정
  // (서버 game-over 이벤트가 누락된 경우에만 작동)
  useEffect(() => {
    // 이미 게임 종료면 스킵
    if (gameOverData) return
    // 아직 합법수 응답이 없으면 스킵
    if (!hasLegalMovesResponse) return
    // 내 턴이 아니면 스킵 (내 턴 시작 시에만 판정)
    if (!gameState || gameState.currentTurn !== myColor) return

    const noLegalMoves = serverLegalMoves.length === 0

    if (noLegalMoves) {
      if (isCheck) {
        // 내가 체크 상태인데 합법수 없음 = 내가 체크메이트 당함
        const winner = myColor === 'white' ? 'black' : 'white'
        console.log('🏁 Checkmate detected (backup): I lost, notifying server...')
        setIsCheckmate(true)
        setGameOverData({ winner, reason: 'checkmate' })
        // 서버에 알려서 상대방에게도 game-over 전송
        socketService.declareGameEnd(gameState.roomId, winner, 'checkmate')
      } else {
        // 체크 아닌데 합법수 없음 = 스테일메이트
        console.log('🏁 Stalemate detected (backup), notifying server...')
        setGameOverData({ winner: 'draw', reason: 'stalemate' })
        // 서버에 알려서 상대방에게도 game-over 전송
        socketService.declareGameEnd(gameState.roomId, 'draw', 'stalemate')
      }
    }
  }, [hasLegalMovesResponse, serverLegalMoves, isCheck, gameState?.currentTurn, myColor, gameOverData])

  // 타이머 카운트다운
  useEffect(() => {
    if (!gameState || gameState.status !== 'playing' || gameOverData) return

    const interval = setInterval(() => {
      if (gameState.currentTurn === myColor) {
        setMyTime(prev => Math.max(0, prev - 1))
      } else {
        setOpponentTime(prev => Math.max(0, prev - 1))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gameState?.currentTurn, gameState?.status, gameOverData, myColor])

  // 보드 변화 감지하여 잡힌 기물 추적
  useEffect(() => {
    if (!gameState?.board || previousBoard.length === 0) {
      // 초기 보드 설정
      if (gameState?.board) {
        setPreviousBoard(gameState.board.map(row => [...row]))
      }
      return
    }

    const opponentColor = myColor === 'white' ? 'black' : 'white'
    
    // 보드가 실제로 변경되었는지 확인
    let boardChanged = false
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const prev = previousBoard[row][col]
        const curr = gameState.board[row][col]
        if ((prev === null && curr !== null) || 
            (prev !== null && curr === null) ||
            (prev !== null && curr !== null && (prev.type !== curr.type || prev.color !== curr.color))) {
          boardChanged = true
          break
        }
      }
      if (boardChanged) break
    }

    // 보드가 변경되지 않았으면 early return
    if (!boardChanged) {
      return
    }

    // 이전 보드와 현재 보드 비교
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const prevPiece = previousBoard[row][col]
        const currPiece = gameState.board[row][col]

        // 기물이 바뀐 경우 = 캡처 발생 (체스에서 캡처는 항상 기물이 상대 기물 위치로 이동)
        if (prevPiece && currPiece && prevPiece.color !== currPiece.color) {
          if (prevPiece.color === opponentColor) {
            // 상대 기물이 내 기물로 바뀜 = 내가 상대 기물을 잡음
            setMyCapturedPieces(prev => [...prev, prevPiece.type])
          } else if (prevPiece.color === myColor) {
            // 내 기물이 상대 기물로 바뀜 = 상대가 내 기물을 잡음
            setOpponentCapturedPieces(prev => [...prev, prevPiece.type])
          }
        }
      }
    }

    // 현재 보드를 이전 보드로 저장
    setPreviousBoard(gameState.board.map(row => [...row]))
  }, [gameState?.board, myColor])

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">게임을 불러오는 중...</div>
          <div className="text-gray-400">Game ID: {gameId}</div>
        </div>
      </div>
    )
  }

  // myColor를 사용하여 설정
  const isMyTurn = gameState.currentTurn === myColor

  const opponent = myColor === 'white' ? gameState.black : gameState.white
  const me = myColor === 'white' ? gameState.white : gameState.black

  const handleMove = (move: Move) => {
    // Prevent moves if game is over
    if (gameOverData || gameState?.status !== 'playing') {
      console.log('Game is over, move prevented')
      return
    }

    // 내가 둔 수이므로 직전에 둔 색을 저장
    setLastMoverColor(myColor)

    // Server-authoritative: send move without optimistic local update
    if (gameState) {
      socketService.sendMove(gameState.roomId, move)
      console.log('Move sent to server:', move)
    }
  }

  // 서버 제공 합법수 기반으로 특정 말의 legal moves 반환
  const fetchLegalMovesFromServer = async ({ row, col }: { row: number; col: number; piece?: Piece }) => {
    if (!gameState) return []
    // ensure we have latest legal moves; request if empty
    if (serverLegalMoves.length === 0) {
      socketService.requestLegalMoves(gameState.roomId)
    }

    const square = rowColToSquare(row, col)
    const fromUci = squareToUci(square)
    const moves = serverLegalMoves.filter(m => m.from === fromUci).map(m => ({ row: squareToRowCol({ file: m.to[0] as any, rank: parseInt(m.to[1]) as any }).row, col: squareToRowCol({ file: m.to[0] as any, rank: parseInt(m.to[1]) as any }).col }))
    return moves
  }

  // 백엔드 연동 시 fetchLegalMoves를 교체하세요.
  // 모든 기물의 합법적 수를 계산하는 함수
  const fetchLegalMovesMock = async ({ row, col, piece }: { row: number; col: number; piece: Piece }) => {
    const moves: { row: number; col: number }[] = []
    const forward = piece.color === 'white' ? -1 : 1

    // 도움 함수: 직선 이동 (룩, 비숍, 퀸용)
    const addLineMoves = (directions: [number, number][]) => {
      directions.forEach(([dr, dc]) => {
        let r = row + dr
        let c = col + dc
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = gameState.board[r][c]
          if (!target) {
            // 빈 칸이면 추가
            moves.push({ row: r, col: c })
          } else if (target.color !== piece.color) {
            // 상대 기물이면 추가하고 중단
            moves.push({ row: r, col: c })
            break
          } else {
            // 자신의 기물이면 중단
            break
          }
          r += dr
          c += dc
        }
      })
    }

    if (piece.type === 'p') {
      // 폰: 전진 1칸 또는 2칸 (빈 칸만), 대각선 캡처
      const one = row + forward
      const two = row + forward * 2

      // 전진
      if (one >= 0 && one < 8 && !gameState.board[one][col]) {
        moves.push({ row: one, col })

        // 첫 수 더블 무브
        const startRank = piece.color === 'white' ? 6 : 1
        if (row === startRank && !gameState.board[two][col]) {
          moves.push({ row: two, col })
        }
      }

      // 대각선 캡처
      if (one >= 0 && one < 8) {
        for (const dc of [-1, 1]) {
          const nc = col + dc
          if (nc >= 0 && nc < 8) {
            const target = gameState.board[one][nc]
            if (target && target.color !== piece.color) {
              moves.push({ row: one, col: nc })
            }
          }
        }
      }
    } else if (piece.type === 'n') {
      // 나이트: 8가지 L자 이동
      const deltas = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      deltas.forEach(([dr, dc]) => {
        const r = row + dr
        const c = col + dc
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = gameState.board[r][c]
          if (!target || target.color !== piece.color) {
            moves.push({ row: r, col: c })
          }
        }
      })
    } else if (piece.type === 'b') {
      // 비숍: 4대각선 방향
      addLineMoves([
        [-1, -1], [-1, 1], [1, -1], [1, 1],
      ])
    } else if (piece.type === 'r') {
      // 룩: 4수평/수직 방향
      addLineMoves([
        [-1, 0], [1, 0], [0, -1], [0, 1],
      ])
    } else if (piece.type === 'q') {
      // 퀸: 8방향 (룩 + 비숍)
      addLineMoves([
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
      ])
    } else if (piece.type === 'k') {
      // 킹: 한 칸씩 8방향
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const r = row + dr
          const c = col + dc
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const target = gameState.board[r][c]
            if (!target || target.color !== piece.color) {
              moves.push({ row: r, col: c })
            }
          }
        }
      }
    }

    return moves
  }

  const handleResign = () => {
    if (confirm('정말 기권하시겠습니까?')) {
      // TODO: 항복 처리
      console.log('Player resigned')
    }
  }

  const handleDrawOffer = () => {
    if (confirm('무승부를 제안하시겠습니까?')) {
      // TODO: 무승부 제안
      console.log('Draw offered')
    }
  }

  // 시간 포맷팅 (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // PGN을 이동 목록으로 파싱
  const parseMoves = (pgn: string) => {
    if (!pgn) return []
    const moves: { move: number; white: string; black?: string }[] = []
    const parts = pgn.trim().split(/\s+/)
    
    let currentMove = 0
    let moveObj: { move: number; white: string; black?: string } | null = null
    
    parts.forEach(part => {
      if (part.match(/^\d+\.$/)) {
        if (moveObj) moves.push(moveObj)
        currentMove = parseInt(part)
        moveObj = { move: currentMove, white: '' }
      } else if (moveObj) {
        if (!moveObj.white) {
          moveObj.white = part
        } else if (!moveObj.black) {
          moveObj.black = part
        }
      }
    })
    
    if (moveObj) moves.push(moveObj)
    return moves
  }

  // 기물 점수 계산
  const calculateMaterial = (color: PieceColor) => {
    const values: Record<PieceType, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0, // 킹은 점수에 포함하지 않음
    }
    
    let total = 0
    gameState?.board.forEach(row => {
      row.forEach(piece => {
        if (piece && piece.color === color) {
          total += values[piece.type]
        }
      })
    })
    
    return total
  }

  const opponentColor: PieceColor = myColor === 'white' ? 'black' : 'white'
  const myMaterial = calculateMaterial(myColor)
  const opponentMaterial = calculateMaterial(opponentColor)
  const materialDiff = myMaterial - opponentMaterial
  
  // 바 너비 계산 (최대 ±10점 차이를 기준으로)
  const maxDiff = 10
  const normalizedDiff = Math.max(-maxDiff, Math.min(maxDiff, materialDiff))
  const barPercentage = 50 + (normalizedDiff / maxDiff) * 50

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              {gameOverData.reason === 'checkmate' ? '👑 Checkmate!' : '🤝 Game Over'}
            </h2>
            <p className="text-xl mb-6">
              {gameOverData.winner === 'draw'
                ? `Game ended in ${gameOverData.reason}`
                : `Winner: ${gameOverData.winner === myColor ? 'You!' : 'Opponent'}`
              }
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 grid place-items-center rounded-sm bg-green-600 text-white font-black text-xs">♟</div>
            <span className="font-semibold">Mad Chess</span>
            <span className="text-xs text-slate-400">PvP Deck Builder Mode</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="h-8 w-8 grid place-items-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">⚙</button>
            <button className="h-8 w-8 grid place-items-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">🔔</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          {/* 왼쪽: 체스판 */}
          <div className="flex flex-col gap-4">
            <div className="inline-block">
              <ChessBoard
                board={gameState?.board || []}
                currentTurn={gameState?.currentTurn || 'white'}
                myColor={myColor}
                isMyTurn={gameState?.currentTurn === myColor}
                lastMove={gameState?.lastMove}
                isCheck={isCheck || gameState?.isCheck || false}
                onMove={handleMove}
                useImages={useImages}
                fetchLegalMoves={fetchLegalMovesFromServer}
              />
            </div>

            {/* 하단 버튼 */}
            {gameState?.currentTurn === myColor && !gameOverData && (
              <div className="rounded-xl border border-green-600 bg-green-900/20 p-4">
                <div className="text-sm font-semibold text-green-400 mb-3 text-center">
                  당신의 차례입니다 (YOUR TURN)
                </div>
                <div className="text-xs text-slate-400 text-center mb-3">
                  다음 수를 선택하세요
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDrawOffer}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors"
                  >
                    무승부 요청
                  </button>
                  <button
                    onClick={handleResign}
                    className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg font-semibold transition-colors"
                  >
                    기권
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽 패널 */}
          <div className="flex flex-col gap-4">
            {/* 상대 프로필 */}
            <div className="rounded-xl border border-gray-800 bg-slate-800/40 p-4">
              <div className="flex items-center gap-4">
                <img
                  src={`https://api.dicebear.com/8.x/avataaars/svg?seed=${opponent?.username}`}
                  alt="opponent"
                  className="h-16 w-16 rounded-lg bg-slate-700"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="font-semibold text-lg">{opponent?.username || 'player456'}</div>
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded inline-block ${opponent?.color === 'white' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 border border-slate-600'}`}>
                        {opponent?.color === 'white' ? 'WHITE' : 'BLACK'}
                      </div>
                    </div>
                    <div className="text-sm">
                      Rating: <span className="font-semibold text-yellow-400">{opponent?.rating || 1450}</span>
                    </div>
                  </div>
                  <CapturedBar
                    pieces={opponentCapturedPieces}
                    pieceColor={myColor}
                    label="Captured your pieces"
                  />
                </div>
              </div>
              {/* 타이머 */}
              <div className="mt-3 flex items-center justify-between px-4 py-2 rounded-lg bg-slate-900">
                <span className="text-xs text-slate-400 uppercase">Time Remaining</span>
                <span className="text-xl font-bold font-mono">{formatTime(opponentTime)}</span>
              </div>
            </div>

            {/* 대국 기록 */}
            <div className="flex-1 rounded-xl border border-gray-800 bg-slate-800/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">대국 기록 (History)</h2>
                <button className="text-xs text-blue-400 hover:underline">↻</button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {parseMoves(gameState?.pgn || '').map((m, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[auto_1fr_1fr] gap-3 px-3 py-2 rounded-md text-sm ${
                      idx === parseMoves(gameState?.pgn || '').length - 1 ? 'bg-green-900/40' : 'hover:bg-slate-700/40'
                    }`}
                  >
                    <span className="text-slate-400">{m.move}.</span>
                    <span className="font-mono">{m.white}</span>
                    <span className="font-mono text-slate-300">{m.black || ''}</span>
                  </div>
                ))}
                {!gameState?.pgn && (
                  <div className="text-center text-slate-500 py-8 text-sm">
                    * Move powered by Swift Reflexes© card
                  </div>
                )}
              </div>
            </div>

            {/* 내 프로필 */}
            <div className="rounded-xl border border-gray-800 bg-slate-800/40 p-4">
              <div className="flex items-center gap-4">
                <img
                  src={`https://api.dicebear.com/8.x/avataaars/svg?seed=${me?.username}`}
                  alt="me"
                  className="h-16 w-16 rounded-lg bg-slate-700"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="font-semibold text-lg">{me?.username || '나 (YOU)'}</div>
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded inline-block ${myColor === 'white' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 border border-slate-600'}`}>
                        {myColor === 'white' ? 'WHITE' : 'BLACK'}
                      </div>
                    </div>
                    <div className="text-sm">
                      Rating: <span className="font-semibold text-yellow-400">{me?.rating || 1520}</span>
                    </div>
                  </div>
                  <CapturedBar
                    pieces={myCapturedPieces}
                    pieceColor={myColor === 'white' ? 'black' : 'white'}
                    label="You captured"
                  />
                </div>
              </div>
              {/* 타이머 */}
              <div className="mt-3 flex items-center justify-between px-4 py-2 rounded-lg bg-blue-900/40">
                <span className="text-xs text-slate-400 uppercase">Your Move</span>
                <span className="text-xl font-bold font-mono text-blue-400">{formatTime(myTime)}</span>
              </div>
            </div>

            {/* 기물 밸런스 */}
            <div className="rounded-xl border border-gray-800 bg-slate-800/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">기물 밸런스 (Material)</h3>
                <div className={`text-lg font-bold ${materialDiff > 0 ? 'text-green-400' : materialDiff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {materialDiff > 0 ? '+' : ''}{materialDiff}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-xs font-semibold px-2 py-0.5 rounded shadow ${myColor === 'white' ? 'bg-white text-gray-900 border border-gray-300' : 'bg-black text-white border border-white/40'}`}>
                  {myColor === 'white' ? 'W' : 'B'}
                </div>
                <div className="flex-1">
                  <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-300 ${myColor === 'white' ? 'bg-white' : 'bg-black'}`}
                      style={{ width: `${barPercentage}%` }}
                    ></div>
                    <div
                      className={`absolute inset-y-0 right-0 transition-all duration-300 ${opponentColor === 'white' ? 'bg-white/80' : 'bg-black'}`}
                      style={{ width: `${100 - barPercentage}%` }}
                    ></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/10 pointer-events-none"></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-3 w-3 rounded-full border ${myColor === 'white' ? 'bg-white border-gray-300' : 'bg-black border-white/60'}`}></span>
                      <span>{myMaterial}점</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-3 w-3 rounded-full border ${opponentColor === 'white' ? 'bg-white border-gray-300' : 'bg-black border-white/60'}`}></span>
                      <span>{opponentMaterial}점</span>
                    </span>
                  </div>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded shadow ${opponentColor === 'white' ? 'bg-white text-gray-900 border border-gray-300' : 'bg-black text-white border border-white/40'}`}>
                  {opponentColor === 'white' ? 'W' : 'B'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
