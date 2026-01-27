import { useParams, useNavigate } from 'react-router-dom'
import React, { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useAuthStore } from '../stores/authStore'
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
    <div className="mt-3 w-full border border-gray-800 bg-[#0A0A0A] p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
        {label} ({pieces.length})
      </div>
      <div className="flex items-center gap-1 flex-wrap min-h-[32px]">
        {pieces.length === 0 ? (
          <span className="text-xs text-gray-600 italic">None</span>
        ) : (
          pieces.map((piece, idx) => (
            <div
              key={`${piece}-${idx}`}
              className="w-8 h-8 bg-gray-800/50 rounded grid place-items-center"
            >
              <img
                src={PIECE_IMAGES[pieceColor][piece]}
                alt={piece}
                className="w-7 h-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
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
  const navigate = useNavigate()
  const { user } = useAuthStore()
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
  const [castlingOptions, setCastlingOptions] = useState<Array<{ rookPos: string; kingPos: string; kingTarget: string; rookTarget: string; side: 'kingside' | 'queenside' }>>([])

  // Draw offer state
  const [showDrawOffer, setShowDrawOffer] = useState(false)
  const [drawOfferPending, setDrawOfferPending] = useState(false)

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
    // UCI를 algebraic notation으로 변환하는 함수
    const uciToAlgebraic = (uci: string, piece: PieceType, capturedPiece?: PieceType): string => {
      console.log(`🔄 Converting UCI to algebraic: uci=${uci}, piece=${piece}, captured=${capturedPiece}`)

      const from = uci.substring(0, 2)
      const to = uci.substring(2, 4)
      const promotion = uci.length > 4 ? uci.substring(4) : undefined

      const toFile = to[0]
      const toRank = to[1]
      const fromFile = from[0]
      const fromFileCode = from.charCodeAt(0) - 97 // a=0, b=1, ...
      const toFileCode = to.charCodeAt(0) - 97
      const isCapture = !!capturedPiece

      let notation = ''

      // 캐슬링 감지 (킹이 2칸 이동)
      if (piece === 'k' && Math.abs(toFileCode - fromFileCode) === 2) {
        if (toFile === 'g') {
          notation = 'O-O' // 킹사이드 캐슬링
          console.log(`♜ Kingside castling detected`)
        } else if (toFile === 'c') {
          notation = 'O-O-O' // 퀸사이드 캐슬링
          console.log(`♜ Queenside castling detected`)
        }
      } else if (piece === 'p') {
        // 폰 이동
        if (isCapture) {
          notation = `${fromFile}x${to}`
        } else {
          notation = to
        }
        // 프로모션
        if (promotion) {
          notation += `=${promotion.toUpperCase()}`
        }
      } else {
        // 다른 기물
        const pieceSymbol = piece.toUpperCase()
        notation = pieceSymbol

        // 캡처
        if (isCapture) {
          notation += 'x'
        }

        notation += to
      }

      console.log(`✅ Algebraic notation: ${notation}`)
      return notation
    }

    const handleMoveMade = (data: any) => {
      console.log('📥 Received move-made from server:', data)

      const mySocketId = socketService.getSocket()?.id
      const iMoved = data.socketId === mySocketId
      const currentMyColor = myColorRef.current
      const opponentColor = currentMyColor === 'white' ? 'black' : 'white'

      // Update check status
      setIsCheck(data.isCheck || false)
      setIsCheckmate(data.isCheckmate || false)

      // PGN 업데이트 (applyOpponentMove 전에 계산)
      const currentState = useGameStore.getState().gameState
      if (currentState) {
        const moverColor = iMoved ? currentMyColor : opponentColor
        console.log(`🎯 Move by: ${moverColor}, moveCount: ${currentState.moveCount}`)

        // Algebraic notation으로 변환
        const algebraicMove = uciToAlgebraic(data.move.uci, data.move.piece, data.move.captured)

        let newPgn = currentState.pgn

        if (moverColor === 'white') {
          // 백의 수: "1. e4" 형식
          const moveNumber = Math.floor(currentState.moveCount / 2) + 1
          if (newPgn) {
            newPgn += ` ${moveNumber}. ${algebraicMove}`
          } else {
            newPgn = `1. ${algebraicMove}`
          }
          console.log(`⚪ White move ${moveNumber}: ${algebraicMove}`)
        } else {
          // 흑의 수: 같은 줄에 추가
          newPgn += ` ${algebraicMove}`
          console.log(`⚫ Black move: ${algebraicMove}`)
        }

        console.log(`📝 New PGN: "${newPgn}"`)
        useGameStore.getState().updatePgn(newPgn)
      }

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

    // 캐슬링 옵션 응답
    const handleCastlingOptions = (data: { options: Array<{ rookPos: string; kingPos: string; kingTarget: string; rookTarget: string; side: 'kingside' | 'queenside' }> }) => {
      console.log('♜ Castling options received:', data.options)
      setCastlingOptions(data.options || [])

      // 로그로 캐슬링 가능 여부 표시
      if (data.options && data.options.length > 0) {
        data.options.forEach(option => {
          console.log(`✅ Castling available: ${option.side} (rook at ${option.rookPos})`)
        })
      } else {
        console.log('❌ No castling options available')
      }
    }

    const handleCastlingOptionsError = (data: { message: string }) => {
      console.error('Castling options error:', data.message)
    }

    socketService.onMoveMade(handleMoveMade)
    socketService.onGameOver(handleGameOver)
    socketService.onMoveError(handleMoveError)
    socketService.onLegalMoves(handleLegalMoves)
    socketService.onLegalMovesError(handleLegalMovesError)
    socketService.onCastlingOptions(handleCastlingOptions)
    socketService.onCastlingOptionsError(handleCastlingOptionsError)

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
      console.log('🎯 My turn started, requesting legal moves and castling options')
      setHasLegalMovesResponse(false)
      setServerLegalMoves([])
      socketService.requestLegalMoves(gameState.roomId)

      // 캐슬링 옵션 요청
      socketService.requestCastlingOptions(gameState.roomId, myColor)
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

    // 프로모션 체크: 폰이 끝 랭크로 이동하는지 확인
    if (gameState) {
      // UCI 파싱: "e2e4" 또는 "e7e8" (프로모션 후보)
      const from = move.uci.substring(0, 2)
      const to = move.uci.substring(2, 4)
      const fromSquare = squareToRowCol({ file: from[0] as any, rank: parseInt(from[1]) as any })
      const toSquare = squareToRowCol({ file: to[0] as any, rank: parseInt(to[1]) as any })
      const piece = gameState.board[fromSquare.row][fromSquare.col]

      // 폰이 끝 랭크(1랭크 또는 8랭크)에 도달하는 경우
      if (piece && piece.type === 'p') {
        const promotionRank = piece.color === 'white' ? 0 : 7 // row index (0 = 8랭크, 7 = 1랭크)
        if (toSquare.row === promotionRank) {
          console.log('🎯 Promotion detected! Showing UI...')
          setPromotionMove({ from, to })
          setShowPromotion(true)
          return // 프로모션 선택 후 전송
        }
      }
    }

    // 내가 둔 수이므로 직전에 둔 색을 저장
    setLastMoverColor(myColor)

    // Server-authoritative: send move without optimistic local update
    if (gameState) {
      socketService.sendMove(gameState.roomId, move)
      console.log('Move sent to server:', move)
    }
  }

  // 프로모션 선택 핸들러
  const handlePromotionSelect = (pieceType: 'q' | 'r' | 'b' | 'n') => {
    if (!promotionMove || !gameState) return

    console.log(`✅ Promotion selected: ${pieceType}`)

    // UCI에 프로모션 추가: "e7e8q"
    const uci = `${promotionMove.from}${promotionMove.to}${pieceType}`
    const move: Move = {
      uci,
      piece: 'p',
    }

    // 내가 둔 수이므로 직전에 둔 색을 저장
    setLastMoverColor(myColor)

    // 서버로 프로모션 정보 포함하여 전송
    socketService.sendMove(gameState.roomId, move)
    console.log('Promotion move sent to server:', move)

    // 프로모션 UI 닫기
    setShowPromotion(false)
    setPromotionMove(null)
  }

  // 프로모션 취소 핸들러
  const handlePromotionCancel = () => {
    console.log('❌ Promotion cancelled')
    setShowPromotion(false)
    setPromotionMove(null)
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
      if (gameState) {
        // 기권 처리: 상대가 승리
        const winner = myColor === 'white' ? 'black' : 'white'
        socketService.resign(gameState.roomId)
        setGameOverData({ winner, reason: 'resignation' })
        console.log('🏳️ Player resigned')
      }
    }
  }

  const handleDrawOffer = () => {
    if (drawOfferPending) {
      alert('이미 무승부 제안을 보냈습니다. 상대방의 응답을 기다려주세요.')
      return
    }
    if (confirm('무승부를 제안하시겠습니까?')) {
      if (gameState) {
        socketService.offerDraw(gameState.roomId)
        setDrawOfferPending(true)
        console.log('🤝 Draw offered')
      }
    }
  }

  const handleDrawResponse = (accept: boolean) => {
    if (gameState) {
      socketService.respondToDraw(gameState.roomId, accept)
      setShowDrawOffer(false)
      if (accept) {
        setGameOverData({ winner: 'draw', reason: 'mutual agreement' })
      }
    }
  }

  // Draw offer received handler
  useEffect(() => {
    const handleDrawOffered = () => {
      setShowDrawOffer(true)
    }

    socketService.onDrawOffered(handleDrawOffered)

    return () => {
      socketService.offDrawOffered()
    }
  }, [])

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
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Game Over Modal */}
      {gameOverData && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] border border-gray-800 p-8 max-w-md w-full mx-4 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-[#D4FF00] flex items-center justify-center">
              <span className="text-2xl">{gameOverData.reason === 'checkmate' ? '👑' : '🤝'}</span>
            </div>
            <h2 className="text-2xl font-serif mb-2">
              {gameOverData.reason === 'checkmate' ? 'CHECKMATE' : 'GAME OVER'}
            </h2>
            <p className="text-lg text-gray-400 mb-6">
              {gameOverData.winner === 'draw'
                ? `Game ended in ${gameOverData.reason}`
                : gameOverData.winner === myColor ? 'Victory!' : 'Defeat'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-[#D4FF00] text-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors"
            >
              Back to Arena
            </button>
          </div>
        </div>
      )}

      {/* Draw Offer Modal */}
      {showDrawOffer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] border border-gray-800 p-8 max-w-md w-full mx-4 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-800 flex items-center justify-center">
              <span className="text-2xl">🤝</span>
            </div>
            <h2 className="text-2xl font-serif mb-2">DRAW OFFER</h2>
            <p className="text-lg text-gray-400 mb-6">
              상대방이 무승부를 제안했습니다
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleDrawResponse(false)}
                className="border border-gray-800 text-gray-400 py-3 font-bold uppercase tracking-widest text-sm hover:text-white hover:border-gray-600 transition-colors"
              >
                거절
              </button>
              <button
                onClick={() => handleDrawResponse(true)}
                className="bg-[#D4FF00] text-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors"
              >
                수락
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotion Modal */}
      {showPromotion && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={handlePromotionCancel}
        >
          <div
            className="bg-[#0A0A0A] border border-gray-800 p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-serif mb-2 text-center">PROMOTION</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">Select a piece</p>
            <div className="flex justify-center gap-3 mb-4">
              {[{ type: 'q', name: 'Queen' }, { type: 'r', name: 'Rook' }, { type: 'b', name: 'Bishop' }, { type: 'n', name: 'Knight' }].map(({ type, name }) => (
                <button
                  key={type}
                  onClick={() => handlePromotionSelect(type as 'q' | 'r' | 'b' | 'n')}
                  className="border border-gray-800 hover:border-[#D4FF00] bg-[#0A0A0A] p-3 transition-colors flex flex-col items-center gap-1"
                >
                  <img
                    src={PIECE_IMAGES[myColor][type as PieceType]}
                    alt={name}
                    className="w-10 h-10"
                  />
                  <span className="text-xs text-gray-500">{name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handlePromotionCancel}
              className="w-full border border-gray-800 px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-gray-900 bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-white skew-x-12"></div>
            <div className="font-serif text-lg">
              <span className="text-[#D4FF00]">MAD</span>
              <span className="text-white">CHESS</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500 uppercase tracking-widest">Live Match</div>
            <div className="w-2 h-2 bg-[#D4FF00] animate-pulse"></div>
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
                castlingOptions={castlingOptions}
              />
            </div>

            {/* 하단 버튼 */}
            {gameState?.currentTurn === myColor && !gameOverData && (
              <div className="border border-[#D4FF00] bg-[#D4FF00]/5 p-4">
                <div className="text-sm font-serif text-[#D4FF00] mb-3 text-center">
                  YOUR TURN
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDrawOffer}
                    className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 uppercase tracking-widest text-xs font-bold transition-colors"
                  >
                    Draw
                  </button>
                  <button
                    onClick={handleResign}
                    className="px-4 py-2 border border-red-900 text-red-500 hover:bg-red-900/20 uppercase tracking-widest text-xs font-bold transition-colors"
                  >
                    Resign
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽 패널 */}
          <div className="flex flex-col gap-4">
            {/* 상대 프로필 */}
            <div className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="flex items-center gap-4">
                {opponent?.picture ? (
                  <img
                    src={opponent.picture}
                    alt={opponent?.username || 'Opponent'}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-800 flex items-center justify-center font-serif text-lg rounded-full">
                    {opponent?.username?.[0]?.toUpperCase() || 'O'}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{opponent?.username || 'Opponent'}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-widest">
                        {opponent?.color === 'white' ? 'WHITE' : 'BLACK'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {opponent?.rating || 1500}
                    </div>
                  </div>
                  <CapturedBar
                    pieces={opponentCapturedPieces}
                    pieceColor={myColor}
                    label="Captured"
                  />
                </div>
              </div>
              {/* 타이머 */}
              <div className="mt-3 flex items-center justify-between px-4 py-3 bg-[#050505] border border-gray-900">
                <span className="text-xs text-gray-600 uppercase tracking-widest">Time</span>
                <span className="text-2xl font-mono font-light">{formatTime(opponentTime)}</span>
              </div>
            </div>

            {/* 대국 기록 */}
            <div className="flex-1 border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs uppercase tracking-widest text-gray-500">Move History</h2>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-sm">
                {parseMoves(gameState?.pgn || '').map((m, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[2rem_1fr_1fr] gap-2 px-2 py-1.5 ${idx === parseMoves(gameState?.pgn || '').length - 1 ? 'bg-[#D4FF00]/10 border-l-2 border-[#D4FF00]' : 'hover:bg-gray-900'
                      }`}
                  >
                    <span className="text-gray-600">{m.move}.</span>
                    <span className="text-white">{m.white}</span>
                    <span className="text-gray-400">{m.black || ''}</span>
                  </div>
                ))}
                {!gameState?.pgn && (
                  <div className="text-center text-gray-600 py-8 text-xs uppercase tracking-widest">
                    No moves yet
                  </div>
                )}
              </div>
            </div>

            {/* 내 프로필 */}
            <div className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="flex items-center gap-4">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user?.name || 'You'}
                    className="h-12 w-12 rounded-full object-cover border-2 border-[#D4FF00]"
                  />
                ) : (
                  <div className="h-12 w-12 bg-[#D4FF00] flex items-center justify-center font-serif text-lg text-black rounded-full">
                    {user?.name?.[0]?.toUpperCase() || me?.username?.[0]?.toUpperCase() || 'Y'}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{user?.name || me?.username || 'You'}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-widest">
                        {myColor === 'white' ? 'WHITE' : 'BLACK'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {user?.rating || me?.rating || 1500}
                    </div>
                  </div>
                  <CapturedBar
                    pieces={myCapturedPieces}
                    pieceColor={myColor === 'white' ? 'black' : 'white'}
                    label="Captured"
                  />
                </div>
              </div>
              {/* 타이머 */}
              <div className="mt-3 flex items-center justify-between px-4 py-3 bg-[#050505] border border-[#D4FF00]/30">
                <span className="text-xs text-[#D4FF00] uppercase tracking-widest">Your Time</span>
                <span className="text-2xl font-mono font-light text-[#D4FF00]">{formatTime(myTime)}</span>
              </div>
            </div>

            {/* 기물 밸런스 */}
            <div className="border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-widest text-gray-500">Material</h3>
                <div className={`text-lg font-mono ${materialDiff > 0 ? 'text-[#D4FF00]' : materialDiff < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {materialDiff > 0 ? '+' : ''}{materialDiff}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500">{myColor[0].toUpperCase()}</div>
                <div className="flex-1">
                  <div className="relative h-2 bg-gray-900 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-300 bg-[#D4FF00]"
                      style={{ width: `${barPercentage}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{myMaterial}</span>
                    <span>{opponentMaterial}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{opponentColor[0].toUpperCase()}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
