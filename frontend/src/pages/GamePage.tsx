import { useParams, useNavigate } from 'react-router-dom'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Chess } from 'chess.js'
import { useGameStore } from '../stores/gameStore'
import { useAuthStore } from '../stores/authStore'
import ChessBoard from '../components/ChessBoard'
import { Timer } from '../components/Timer'
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
              className="w-8 h-8 bg-gray-400 rounded grid place-items-center"
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

export function EvalBar({ evaluation }: { evaluation: { type: 'cp' | 'mate', value: number } | null }) {
  if (!evaluation) return <div className="w-6 h-full bg-gray-800/50 rounded border border-gray-700"></div>

  let percent = 50
  let label = '0.0'

  if (evaluation.type === 'mate') {
    if (evaluation.value > 0) {
      percent = 100
      label = `M${evaluation.value}`
    } else {
      percent = 0
      label = evaluation.value === 0 ? '#' : `M${Math.abs(evaluation.value)}`
    }
  } else {
    // Sigmoid mapping for CP
    const score = evaluation.value
    // Lichess-style winning chance
    const winChance = 1 / (1 + Math.exp(-0.004 * score))
    percent = winChance * 100
    label = (score / 100).toFixed(1)
    if (score > 0) label = '+' + label
  }

  // Clamp
  percent = Math.max(0, Math.min(100, percent))

  return (
    <div className="w-6 h-full bg-gray-800 relative flex flex-col-reverse rounded overflow-hidden border border-gray-600 shadow-inner">
      <div
        className="w-full bg-white transition-all duration-700 ease-out"
        style={{ height: `${percent}%` }}
      />
      <div className={`absolute w-full text-center text-[9px] font-bold z-10 ${percent > 50 ? 'text-gray-900 bottom-0.5' : 'text-white top-0.5'}`}>
        {label}
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
  const [premove, setPremove] = useState<Move | null>(null)
  const premoveRef = useRef<Move | null>(null)

  const gameOverDataRef = useRef<{ winner: string; reason: string } | null>(null)
  useEffect(() => { gameOverDataRef.current = gameOverData }, [gameOverData])

  // 타이머 상태 (ms 단위)
  const [whiteTime, setWhiteTime] = useState(600 * 1000)
  const [blackTime, setBlackTime] = useState(600 * 1000)
  // myTime/opponentTime 대신 whiteTime/blackTime 사용

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
  // Analysis State
  const [evalScore, setEvalScore] = useState<{ type: 'cp' | 'mate', value: number } | null>(null)

  // Determine if analysis is allowed (Spectator or Game Over)
  const canAnalyze = React.useMemo(() => {
    if (!gameState) return false
    if (!user?.id) return true // Guest/Spectator usually? Or if not logged in? Assuming spectator if not matched.
    // Actually, if userId matches white/black, it's a player.
    const myId = String(user.id)
    const isPlayer = String(gameState.white?.userId) === myId || String(gameState.black?.userId) === myId
    const isPlaying = gameState.status === 'playing'
    // Allow if NOT player OR NOT playing (Review)
    return !isPlayer || !isPlaying
  }, [gameState?.status, gameState?.white?.userId, gameState?.black?.userId, user?.id])

  useEffect(() => {
    socketService.onAnalysisResult((results: any) => {
      // Backend now sends an array (AnalysisLine[]) because of MultiPV support.
      // GamePage EvalBar only needs the best line.
      if (Array.isArray(results) && results.length > 0) {
        setEvalScore({ type: results[0].type, value: results[0].value })
      } else if (results && !Array.isArray(results)) {
        // Fallback for old single-object format if any
        setEvalScore(results)
      }
    })
    return () => socketService.offAnalysisResult()
  }, [])

  useEffect(() => {
    if (gameState?.roomId && canAnalyze) socketService.requestAnalysis(gameState.roomId)
  }, [gameState?.roomId, gameState?.moveCount, canAnalyze])

  // Game history state - stores board state (FEN-like) for each move
  const [moveHistory, setMoveHistory] = useState<Array<{
    board: (Piece | null)[][];
    pgn: string;
    moveIndex: number;
  }>>([])  // 각 수에 대한 보드 상태 저장
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number>(-1)  // -1 = 최신 상태, 0+ = 해당 수의 보드 상태
  const [isViewingHistory, setIsViewingHistory] = useState(false)  // 히스토리 모드 여부
  const isViewingHistoryRef = useRef(false)
  useEffect(() => { isViewingHistoryRef.current = isViewingHistory }, [isViewingHistory])
  const [showCurrentMessage, setShowCurrentMessage] = useState(false)  // "Current" 메시지 표시 여부

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
    const savedColor = (sessionStorage.getItem('myColor') || sessionStorage.getItem('selectedColor')) as PieceColor | null
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

      // 내 정보 (auth store에서)
      const myUserId = user?.id ? String(user.id) : 'me'
      const myUsername = user?.name || 'You'
      const myRating = user?.rating || 1500
      const myPicture = user?.picture

      // 상대 정보 (sessionStorage에서)
      const opponentInfoStr = sessionStorage.getItem('opponentInfo')
      let opponentUsername = 'Opponent'
      let opponentRating = 1500
      let opponentUserId = 'opponent'
      let opponentDeckId = 'deck-2'
      let opponentPicture: string | undefined

      if (opponentInfoStr) {
        try {
          const opponentInfo = JSON.parse(opponentInfoStr)
          opponentUsername = opponentInfo.username || opponentInfo.name || 'Opponent'
          opponentRating = opponentInfo.rating || 1500
          opponentUserId = opponentInfo.userId || 'opponent'
          opponentDeckId = opponentInfo.deckId || 'deck-2'
          opponentPicture = opponentInfo.picture
        } catch (e) {
          console.error('Failed to parse opponent info:', e)
        }
        sessionStorage.removeItem('opponentInfo')
      }

      const currentColor = savedColor || myColor

      const whitePlayer = currentColor === 'white'
        ? { userId: myUserId, username: myUsername, rating: myRating, deckId: 'deck-1', color: 'white' as const, picture: myPicture }
        : { userId: opponentUserId, username: opponentUsername, rating: opponentRating, deckId: opponentDeckId, color: 'white' as const, picture: opponentPicture }

      const blackPlayer = currentColor === 'black'
        ? { userId: myUserId, username: myUsername, rating: myRating, deckId: 'deck-1', color: 'black' as const, picture: myPicture }
        : { userId: opponentUserId, username: opponentUsername, rating: opponentRating, deckId: opponentDeckId, color: 'black' as const, picture: opponentPicture }

      // gameStore 업데이트
      setGameState({
        roomId: gameId || 'test-room',
        white: whitePlayer,
        black: blackPlayer,
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

      // 초기 보드 상태를 히스토리에 저장 (moveIndex 0 = 게임 시작 상태)
      const initialBoardCopy = newBoard.map(row => row.map(cell => cell ? { ...cell } : null))
      setMoveHistory([{
        board: initialBoardCopy,
        pgn: '',
        moveIndex: 0
      }])
      console.log('📚 Saved initial board state to history')

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

      // Defensive check for missing piece info
      if (!piece) {
        console.warn('⚠️ Missing piece info for algebraic conversion, falling back to UCI')
        return uci
      }

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
      const currentGameState = useGameStore.getState().gameState
      const myId = user?.id ? String(user.id) : null

      // 내 색상 판별 (스토어 정보가 가장 정확함)
      let currentMyColor = myColorRef.current
      if (currentGameState && myId) {
        if (String(currentGameState.white.userId) === myId) currentMyColor = 'white'
        else if (String(currentGameState.black.userId) === myId) currentMyColor = 'black'
      }

      // 내가 움직였는지 판별 (소켓 ID 또는 색상 일치 여부)
      const iMoved = data.socketId === mySocketId || (data.moverColor && data.moverColor === currentMyColor)

      console.log(`📥 handleMoveMade: iMoved=${iMoved}, mover=${data.moverColor}, me=${currentMyColor}, socketId=${data.socketId}`)

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
        console.log(`✨ Algebraic Move: ${algebraicMove}`)

        // Check/Checkmate symbol
        let moveSymbol = ''
        if (data.isCheckmate) moveSymbol = '#'
        else if (data.isCheck) moveSymbol = '+'

        const finalMoveNotation = algebraicMove + moveSymbol
        let newPgn = currentState.pgn

        if (moverColor === 'white') {
          const currentCount = currentState.moveCount ?? 0
          const moveNumber = Math.floor(currentCount / 2) + 1
          if (newPgn) {
            newPgn += ` ${moveNumber}. ${finalMoveNotation}`
          } else {
            newPgn = `${moveNumber}. ${finalMoveNotation}`
          }
          console.log(`⚪ White move ${moveNumber}: ${finalMoveNotation} (Total count: ${currentCount})`)
        } else {
          newPgn += ` ${finalMoveNotation}`
          console.log(`⚫ Black move: ${finalMoveNotation}`)
        }

        console.log(`📝 Calculated New PGN: "${newPgn}"`)
        useGameStore.getState().updatePgn(newPgn)
      }

      // Update Timer from Server
      if (data.whiteTime !== undefined) setWhiteTime(data.whiteTime)
      if (data.blackTime !== undefined) setBlackTime(data.blackTime)

      // Apply server-confirmed game state directly for perfect sync
      // Critical: Only sync if it's a valid and complete gameState
      if (data.gameState && data.gameState.roomId && data.gameState.moveCount !== undefined && data.gameState.moveCount !== null) {
        console.log('🔄 Syncing game state from server:', data.gameState)
        setGameState(data.gameState)
      } else if (data.gameState) {
        console.warn('⚠️ Received incomplete gameState from server, syncing partially...', data.gameState)
        // Merge with existing state to preserve roomId/moveCount if missing from server
        const currentLocalState = useGameStore.getState().gameState
        if (currentLocalState) {
          setGameState({
            ...currentLocalState,
            ...data.gameState,
            roomId: data.gameState.roomId || currentLocalState.roomId,
            moveCount: data.gameState.moveCount !== undefined && data.gameState.moveCount !== null
              ? data.gameState.moveCount
              : currentLocalState.moveCount
          })
        }
      } else {
        // Fallback
        applyOpponentMove(data.move, iMoved)
      }

      // 히스토리 보기 모드에서 벗어나기 (상대가 수를 두면 최신 상태로)
      setIsViewingHistory(false)
      setViewingMoveIndex(-1)

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
          setGameOverData(prev => {
            if (prev) return prev
            return prev
          })
        }, 2000)
      }

      // 내 턴이 되었을 때 프리무브가 있다면 자동 실행
      // 중요: 서버에서 받은 데이터 기준으로 턴을 확인하므로 stale state 문제 없음
      const serverConfirmedTurn = data.gameState?.currentTurn
      const nextTurnIsMe = serverConfirmedTurn === currentMyColor

      if (!iMoved && nextTurnIsMe) {
        setTimeout(() => {
          const latestPremove = premoveRef.current
          const latestGameState = useGameStore.getState().gameState

          if (latestPremove && latestGameState?.roomId && latestGameState.roomId !== 'test-room') {
            console.log('🚀 Executing premove directly (server confirmed my turn):', latestPremove)

            // Clear premove BEFORE sending to prevent double execution
            setPremove(null)
            premoveRef.current = null

            // 프로모션 체크
            const from = latestPremove.uci.substring(0, 2)
            const to = latestPremove.uci.substring(2, 4)
            const toRank = parseInt(to[1])
            const fromSquare = squareToRowCol({ file: from[0] as any, rank: parseInt(from[1]) as any })
            const piece = latestGameState.board?.[fromSquare.row]?.[fromSquare.col]

            let finalMove = latestPremove
            if (piece?.type === 'p' && (toRank === 1 || toRank === 8)) {
              // Auto-promote to queen for premoves
              finalMove = { ...latestPremove, uci: latestPremove.uci + 'q', promotion: 'q' }
              console.log('👑 Auto-promoting premove to queen')
            }

            // Send directly to server, bypassing handleMove's turn check
            socketService.sendMove(latestGameState.roomId, finalMove)
            console.log('📤 Premove sent directly to server:', finalMove)
          } else if (latestPremove) {
            console.log('⚠️ Premove exists but conditions not met. Turn:', serverConfirmedTurn, 'Me:', currentMyColor)
          }
        }, 150) // Slightly shorter delay since we're more confident about state
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
    const handleLegalMoves = (data: { legalMoves: Array<{ from: string; to: string; promotion?: string }>; gameState?: { isCheck: boolean; isCheckmate: boolean; isStalemate: boolean } }) => {
      setServerLegalMoves(data.legalMoves || [])
      setHasLegalMovesResponse(true)

      // 체크 상태 업데이트
      if (data.gameState && gameState) {
        console.log(`♟️ Game state received - Check: ${data.gameState.isCheck}, Checkmate: ${data.gameState.isCheckmate}, Stalemate: ${data.gameState.isStalemate}`)
        setGameState({
          ...gameState,
          isCheck: data.gameState.isCheck
        })
      }
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

    const handleGameRejoined = (data: any) => {
      console.log('✅ Game rejoined:', data)
      if (data.whiteTime !== undefined) setWhiteTime(data.whiteTime)
      if (data.blackTime !== undefined) setBlackTime(data.blackTime)

      if (data.yourColor) {
        setMyColor(data.yourColor)
      }

      const currentState = useGameStore.getState().gameState
      if (data.gameState) {
        setGameState({
          ...data.gameState,
          white: data.white || currentState?.white,
          black: data.black || currentState?.black,
          capturedPieces: data.gameState.capturedPieces || currentState?.capturedPieces || { white: [], black: [] },
          roomId: data.matchId
        })
      }
    }

    const handleRejoinError = (data: { message: string }) => {
      console.error('❌ Rejoin error:', data.message)
    }

    socketService.onMoveMade(handleMoveMade)
    socketService.onGameOver(handleGameOver)
    socketService.onMoveError(handleMoveError)
    socketService.onLegalMoves(handleLegalMoves)
    socketService.onLegalMovesError(handleLegalMovesError)
    socketService.onCastlingOptions(handleCastlingOptions)
    socketService.onCastlingOptionsError(handleCastlingOptionsError)
    socketService.onGameRejoined(handleGameRejoined)
    socketService.onRejoinError(handleRejoinError)

    // 정리
    return () => {
      socketService.offMoveMade()
      socketService.offGameOver()
      socketService.offMoveError()
      socketService.offLegalMoves()
      socketService.offLegalMovesError()
      socketService.offGameRejoined()
      socketService.offRejoinError()
    }
  }, []) // 빈 배열: 한 번만 등록

  // 게임 페이지 로드 시 재참가 시도 (소켓 재연결 및 상태 동기화)
  useEffect(() => {
    if (gameId && user?.id && gameId !== 'test-room') {
      console.log(`🔄 Attempting to rejoin game ${gameId}...`)
      setTimeout(() => {
        socketService.rejoinGame(gameId, user.id.toString())
      }, 500)
    }
  }, [gameId, user?.id])

  // PGN이 업데이트될 때마다 보드 상태를 히스토리에 저장
  useEffect(() => {
    if (!gameState?.board || !gameState?.pgn) return

    const currentMoveCount = gameState.moveCount

    // 이미 저장된 수인지 확인
    const existingEntry = moveHistory.find(h => h.moveIndex === currentMoveCount)
    if (existingEntry) return

    // 새로운 보드 상태 저장 (deep copy)
    const boardCopy = gameState.board.map(row => row.map(cell => cell ? { ...cell } : null))

    setMoveHistory(prev => [
      ...prev,
      {
        board: boardCopy,
        pgn: gameState.pgn,
        moveIndex: currentMoveCount
      }
    ])

    console.log(`📚 Saved board state for move ${currentMoveCount}`)
  }, [gameState?.pgn, gameState?.moveCount])

  // ===== CRITICAL: Auto-sync myColor based on server gameState =====
  // This ensures myColor is always correct even if sessionStorage is cleared or stale
  useEffect(() => {
    if (gameState && user?.id) {
      const myId = String(user.id)
      let correctColor: PieceColor | null = null

      if (String(gameState.white.userId) === myId) {
        correctColor = 'white'
      } else if (String(gameState.black.userId) === myId) {
        correctColor = 'black'
      }

      if (correctColor && correctColor !== myColor) {
        console.log(`🎨 Auto-syncing myColor: ${myColor} → ${correctColor} (based on server gameState)`)
        setMyColor(correctColor)
      }
    }
  }, [gameState?.white?.userId, gameState?.black?.userId, user?.id])

  // 보드나 턴이 바뀔 때마다 합법수 선제 요청 (이동 지연 방지)
  useEffect(() => {
    if (gameState?.roomId && gameState?.status === 'playing' && gameState?.roomId !== 'test-room') {
      console.log('📡 Proactively requesting legal moves for sync...')
      socketService.requestLegalMoves(gameState.roomId)
    }
  }, [gameState?.board, gameState?.currentTurn, myColor])

  // 내 턴이 시작될 때 합법수 및 캐슬링 옵션 요청
  useEffect(() => {
    if (gameState && gameState.currentTurn === myColor && !gameOverDataRef.current && gameState.roomId !== 'test-room') {
      console.log('🎯 My turn started, requesting legal moves and castling options')
      setHasLegalMovesResponse(false)
      setServerLegalMoves([])
      socketService.requestLegalMoves(gameState.roomId)

      // 캐슬링 옵션 요청
      socketService.requestCastlingOptions(gameState.roomId, myColor)
    }
  }, [gameState?.currentTurn, gameState?.roomId, myColor])

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
  // 타이머 카운트다운을 Timer 컴포넌트가 처리하므로 불필요한 useEffect 제거
  // 그러나 초기 시간 동기화나 게임 상태 변경 시 업데이트 필요할 수 있음
  useEffect(() => {
    if (gameState?.whiteTime) setWhiteTime(gameState.whiteTime)
    if (gameState?.blackTime) setBlackTime(gameState.blackTime)
  }, [gameState?.whiteTime, gameState?.blackTime])

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

  // 히스토리 네비게이션 함수들
  const goToPreviousMove = () => {
    if (moveHistory.length === 0) return

    if (!isViewingHistory) {
      // 처음 히스토리 모드 진입: 마지막 수에서 하나 이전으로
      const lastIndex = moveHistory.length - 2
      if (lastIndex >= 0) {
        setIsViewingHistory(true)
        setViewingMoveIndex(lastIndex)
      }
    } else {
      // 이미 히스토리 모드: 이전 수로
      if (viewingMoveIndex > 0) {
        setViewingMoveIndex(viewingMoveIndex - 1)
      }
    }
  }

  const goToNextMove = () => {
    if (!isViewingHistory) return

    const nextIndex = viewingMoveIndex + 1
    if (nextIndex >= moveHistory.length - 1) {
      // 최신 상태로 돌아감
      setIsViewingHistory(false)
      setViewingMoveIndex(-1)

      // "Current" 메시지 표시
      setShowCurrentMessage(true)
      setTimeout(() => setShowCurrentMessage(false), 1000)
    } else {
      setViewingMoveIndex(nextIndex)
    }
  }

  const goToLatestMove = () => {
    setIsViewingHistory(false)
    setViewingMoveIndex(-1)

    // "Current" 메시지 표시
    setShowCurrentMessage(true)
    setTimeout(() => setShowCurrentMessage(false), 1000)
  }

  const goToFirstMove = () => {
    if (moveHistory.length > 0) {
      setIsViewingHistory(true)
      setViewingMoveIndex(0)
    }
  }

  // 현재 표시할 보드 결정
  const displayBoard = isViewingHistory && viewingMoveIndex >= 0 && viewingMoveIndex < moveHistory.length
    ? moveHistory[viewingMoveIndex].board
    : gameState?.board || []

  const handleMove = (move: Move) => {
    // 최신 게임 상태 가져오기 (클로저 stale state 방지)
    const storeState = useGameStore.getState()
    const currentGameState = storeState.gameState
    const currentTurn = currentGameState?.currentTurn
    const currentMyColor = myColorRef.current

    console.log(`🕹 handleMove called. Turn: ${currentTurn}, Me: ${currentMyColor}, Move: ${move.uci}`)

    // 내 색상 결정을 더 확실히 하기 (Store 정보 활용)
    const myId = user?.id ? String(user.id) : null
    let verifiedMyColor = currentMyColor

    if (currentGameState && myId) {
      if (String(currentGameState.white.userId) === myId) verifiedMyColor = 'white'
      else if (String(currentGameState.black.userId) === myId) verifiedMyColor = 'black'
    }

    if (verifiedMyColor !== currentMyColor) {
      console.warn(`🎨 Color mismatch! Ref: ${currentMyColor}, Verified: ${verifiedMyColor}`)
      // Defensive: Update myColor if it was incorrectly set
      setMyColor(verifiedMyColor)
    }

    // 내 턴이 아니면 프리무브로 설정
    if (currentTurn !== verifiedMyColor) {
      console.log(`🔴 Setting premove (Turn=${currentTurn}, Me=${verifiedMyColor}):`, move)
      setPremove(move)
      premoveRef.current = move
      return
    }

    // 내 턴이면 프리무브 초기화
    setPremove(null)
    premoveRef.current = null

    // 히스토리 보기 모드에서는 수를 둘 수 없음 (Ref 사용)
    if (isViewingHistoryRef.current) {
      console.log('Cannot move while viewing history')
      return
    }

    // Prevent moves if game is over (Ref 사용)
    if (gameOverDataRef.current || currentGameState?.status !== 'playing') {
      console.log('Game is over, move prevented')
      return
    }

    // 프로모션 체크: 폰이 끝 랭크로 이동하는지 확인
    if (currentGameState) {
      const from = move.uci.substring(0, 2)
      const to = move.uci.substring(2, 4)
      const fromSquare = squareToRowCol({ file: from[0] as any, rank: parseInt(from[1]) as any })
      const toSquare = squareToRowCol({ file: to[0] as any, rank: parseInt(to[1]) as any })
      const piece = currentGameState.board[fromSquare.row][fromSquare.col]

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

    // Server-authoritative: send move without optimistic local update
    if (currentGameState && currentGameState.roomId) {
      socketService.sendMove(currentGameState.roomId, move)
      console.log(`Move sent to server (Room: ${currentGameState.roomId}):`, move)
    } else {
      console.error('❌ Cannot send move: Current gameState or roomId is missing', { currentGameState })
    }
  }

  // 프로모션 선택 핸들러
  const handlePromotionSelect = (pieceType: 'q' | 'r' | 'b' | 'n') => {
    const storeState = useGameStore.getState()
    const currentGameState = storeState.gameState

    if (!promotionMove || !currentGameState) return

    console.log(`✅ Promotion selected: ${pieceType}`)

    // UCI에 프로모션 추가: "e7e8q"
    const uci = `${promotionMove.from}${promotionMove.to}${pieceType}`
    const move: Move = {
      uci,
      piece: 'p',
    }

    // 전송
    if (currentGameState.roomId) {
      socketService.sendMove(currentGameState.roomId, move)
      console.log(`Promotion move sent to server (Room: ${currentGameState.roomId}):`, move)
    } else {
      console.error('❌ Cannot send promotion: RoomId missing')
    }

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

  // Refactored: Uses client-side calc for premoves, server moves for valid turns
  const fetchLegalMovesFromServer = async ({ row, col, piece }: { row: number; col: number; piece?: Piece }) => {
    if (!gameState) return []

    // Premove logic: use client-side calculation if not my turn
    if (gameState.currentTurn !== myColor) {
      if (!piece) return []
      return fetchLegalMovesMock({ row, col, piece }) // Use client-side logic for premoves
    }

    const square = rowColToSquare(row, col)
    const fromUci = squareToUci(square)

    // If server moves empty, request them (async)
    if (serverLegalMoves.length === 0) {
      socketService.requestLegalMoves(gameState.roomId)
    }

    const moves = serverLegalMoves
      .filter(m => m.from === fromUci)
      .map(m => {
        const to = m.to
        const toPos = squareToRowCol({
          file: to[0] as any,
          rank: parseInt(to[1]) as any
        })
        return { row: toPos.row, col: toPos.col }
      })

    console.log(`📍 Found ${moves.length} legal moves for ${fromUci}`)
    return moves
  }

  const handleResign = () => {
    if (confirm('정말 기권하시겠습니까?')) {
      if (gameState) {
        // 기권 처리: 서버에서 game-over 이벤트를 통해 승자 결정
        socketService.resign(gameState.roomId)
        console.log('🏳️ Player resigned, waiting for server confirmation')
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

  // 시간 초과 처리
  const handleMyTimeout = () => {
    if (gameOverData) return // 이미 게임 종료 상태면 무시
    console.log(`My time out! (${myColor}) Reporting to server...`)
    if (gameState) {
      socketService.reportTimeout(gameState.roomId, myColor)
    }
  }

  const handleOpponentTimeout = () => {
    if (gameOverData) return
    const oppColor = myColor === 'white' ? 'black' : 'white'
    console.log(`Opponent time out! (${oppColor}) Reporting to server...`)
    if (gameState) {
      socketService.reportTimeout(gameState.roomId, oppColor)
    }
  }

  // 시간 포맷팅 (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // PGN을 이동 목록으로 파싱 (UCI -> SAN 변환)
  const parseMoves = useMemo(() => {
    return (pgn: string) => {
      if (!pgn) return []

      const movedList: { move: number; white: string; black?: string }[] = []

      try {
        // PGN string might contain "1. e2e4 2. ..." or just "e2e4 e7e5 ..."
        // We clean it up to extract raw move tokens (UCI or SAN, but likely UCI here)
        let cleanPgn = pgn
          .replace(/\d+\./g, '')
          .replace(/1-0|0-1|1\/2-1\/2/g, '')

        let prev = ''
        while (cleanPgn !== prev) {
          prev = cleanPgn
          cleanPgn = cleanPgn
            .replace(/\[[^[\]]*?\]/g, '')
            .replace(/\{[^\{\}]*?\}/g, '')
        }

        cleanPgn = cleanPgn.replace(/[|"]/g, '').trim()
        if (!cleanPgn) return []

        const tokens = cleanPgn.split(/\s+/).filter(t => t && t.length > 1)

        // Initialize chess engine for SAN generation
        let chess: Chess | null = null
        try {
          // Sanitize FEN:
          // 1. Strip Shredder-FEN characters (e.g. A-H) from castling rights.
          // 2. Remove Pawns from Rank 1 and Rank 8 (Illegal in Standard Chess).
          let fenToUse = gameState?.initialFen
          if (fenToUse) {
            const parts = fenToUse.split(' ')
            if (parts.length >= 3) {
              // 1. Castling Sanitization
              let castling = parts[2].replace(/[^KQkq-]/g, '')
              if (!castling) castling = '-'
              parts[2] = castling

              // 2. Pawn Sanitization (Edge Rows)
              const boardStr = parts[0]
              const rows = boardStr.split('/')
              if (rows.length === 8) {
                // Rank 8 (Index 0) and Rank 1 (Index 7) cannot have Pawns
                rows[0] = rows[0].replace(/[pP]/g, '1')
                rows[7] = rows[7].replace(/[pP]/g, '1')

                // Normalize rows: Collapse adjacent numbers (e.g. "11" -> "2") because chess.js rejects consecutive digits
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
          console.log('DEBUG: parseMoves sanitized FEN:', fenToUse)
          chess = new Chess(fenToUse || undefined)
        } catch (e) {
          console.warn('Initial FEN invalid or chess.js error', e)
          try { chess = new Chess() } catch (err) { chess = null }
        }

        let currentMoveNum = 1
        let currentPair: { move: number; white: string; black?: string } = { move: 1, white: '' }

        tokens.forEach((token, index) => {
          let san = token // Default to token (UCI) if parsing fails

          if (chess) {
            try {
              // Attempt to play move to get SAN
              // Token is expected to be UCI (e.g. "e2e4", "a7a8q")
              const from = token.substring(0, 2)
              const to = token.substring(2, 4)
              const promotion = token.length > 4 ? token.substring(4, 5) : undefined

              const result = chess!.move({
                from,
                to,
                promotion: promotion as any
              })
              if (result) san = result.san
            } catch (e) {
              // Fallback: try parsing as simple SAN or ignore error
              // console.warn('SAN conversion failed for:', token, e)
            }
          }

          if (index % 2 === 0) {
            // White
            currentPair = { move: currentMoveNum, white: san }
          } else {
            // Black
            currentPair.black = san
            movedList.push(currentPair)
            currentMoveNum++
          }
        })

        // Push incomplete last move
        if (tokens.length % 2 !== 0) {
          movedList.push(currentPair)
        }

      } catch (e) {
        console.error('PGN parsing error:', e)
        // CRITICAL FALLBACK: Simply split the string and display
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
  }, [gameState?.initialFen])

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
              <span className="text-2xl">
                {gameOverData.winner === 'draw' ? '🤝' :
                  gameOverData.reason === 'checkmate' ? '👑' :
                    gameOverData.reason === 'timeout' ? '⏰' :
                      gameOverData.reason === 'placement' ? '⚡' : '🏳️'}
              </span>
            </div>
            <h2 className="text-3xl font-serif mb-3 font-bold">
              {gameOverData.winner === 'draw' ? 'DRAW!' :
                gameOverData.winner === 'white' ? 'WHITE won!' : 'BLACK won!'}
            </h2>
            <p className="text-base text-gray-400 mb-6">
              by {gameOverData.reason === 'resignation' ? 'resignation' :
                gameOverData.reason === 'checkmate' ? 'checkmate' :
                  gameOverData.reason === 'timeout' ? 'timeout' :
                    gameOverData.reason === 'stalemate' ? 'stalemate' :
                      gameOverData.reason === 'placement' ? 'placement advantage' :
                        gameOverData.reason === 'mutual agreement' ? 'mutual agreement' :
                          gameOverData.reason}
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
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
            <div className="w-6 h-6 bg-white skew-x-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-80"></div>
            </div>
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
            {/* Premove Indicator */}
            <div className={`h-8 flex items-center px-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${premove ? 'bg-red-900/40 text-red-400 border border-red-900/50 opacity-100' : 'opacity-0'}`}>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Premove Active: {premove?.uci}
              </span>
              <button
                onClick={() => {
                  setPremove(null)
                  premoveRef.current = null
                }}
                className="ml-auto hover:text-white underline transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex gap-4 h-[600px]">
              {canAnalyze && (
                <div className="h-full shrink-0 pt-8 pb-8">
                  <EvalBar evaluation={evalScore} />
                </div>
              )}
              <div className="inline-block relative h-full">
                <ChessBoard
                  board={displayBoard}
                  currentTurn={gameState?.currentTurn || 'white'}
                  myColor={myColor}
                  isMyTurn={gameState?.currentTurn === myColor}
                  lastMove={isViewingHistory ? undefined : gameState?.lastMove}
                  isCheck={isViewingHistory ? false : (isCheck || gameState?.isCheck || false)}
                  onMove={handleMove}
                  useImages={useImages}
                  fetchLegalMoves={fetchLegalMovesFromServer}
                  castlingOptions={isViewingHistory ? [] : castlingOptions}
                  premove={premove || undefined}
                  onClearPmove={() => {
                    setPremove(null)
                    premoveRef.current = null
                  }}
                />
                {/* 히스토리 보기 모드 표시 */}
                {isViewingHistory && (
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-yellow-600/90 text-black px-3 py-1 text-xs font-bold uppercase tracking-widest rounded">
                    Move {viewingMoveIndex + 1} / {moveHistory.length}
                  </div>
                )}
                {/* Current 메시지 표시 (최신 수로 돌아왔을 때) */}
                <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 bg-[#D4FF00]/95 text-black px-3 py-1 text-xs font-bold uppercase tracking-widest rounded transition-all duration-500 ${showCurrentMessage ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                  }`}>
                  Current
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            {!gameOverData && (
              <div className={`border p-4 ${isViewingHistory ? 'border-yellow-600 bg-yellow-600/5' : gameState?.currentTurn === myColor ? 'border-[#D4FF00] bg-[#D4FF00]/5' : 'border-gray-800 bg-gray-900/30'}`}>
                <div className="text-sm font-serif mb-3 text-center">
                  {isViewingHistory ? (
                    <span className="text-yellow-500">VIEWING HISTORY - <button onClick={goToLatestMove} className="underline hover:text-white">Return to game</button></span>
                  ) : gameState?.currentTurn === myColor ? (
                    <span className="text-[#D4FF00]">YOUR TURN</span>
                  ) : (
                    <span className="text-gray-500">OPPONENT'S TURN</span>
                  )}
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
                {canAnalyze && (
                  <button
                    onClick={() => gameState?.roomId && socketService.requestAnalysis(gameState?.roomId)}
                    className="mt-3 w-full px-4 py-2 border border-blue-900 text-blue-400 hover:text-white hover:bg-blue-900/20 uppercase tracking-widest text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                    </svg>
                    Analyze Position
                  </button>
                )}
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
                <Timer
                  initialTime={myColor === 'white' ? blackTime : whiteTime}
                  isActive={!gameOverData && gameState?.currentTurn === (myColor === 'white' ? 'black' : 'white')}
                  onTimeout={handleOpponentTimeout}
                />
              </div>
            </div>

            {/* 대국 기록 */}
            <div className="flex-1 border border-gray-900 bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs uppercase tracking-widest text-[#D4FF00] font-bold">Move History (SAN)</h2>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-sm">
                {parseMoves(gameState?.pgn || '').map((m, idx) => {
                  const whiteMoveIndex = idx * 2 + 1  // 백의 수는 홀수 인덱스 (1, 3, 5...)
                  const blackMoveIndex = idx * 2 + 2  // 흑의 수는 짝수 인덱스 (2, 4, 6...)
                  const totalMoves = parseMoves(gameState?.pgn || '').length
                  const isLastMove = idx === totalMoves - 1

                  // 현재 보고 있는 수 하이라이트
                  const viewingWhite = isViewingHistory && moveHistory[viewingMoveIndex]?.moveIndex === whiteMoveIndex
                  const viewingBlack = isViewingHistory && moveHistory[viewingMoveIndex]?.moveIndex === blackMoveIndex

                  // 최신 수 하이라이트 (히스토리 모드가 아닐 때)
                  const isLatestWhite = !isViewingHistory && isLastMove && !m.black
                  const isLatestBlack = !isViewingHistory && isLastMove && m.black

                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-[2rem_1fr_1fr] gap-2 px-2 py-1.5 ${(isLatestWhite || isLatestBlack) && !isViewingHistory
                        ? 'bg-[#D4FF00]/10 border-l-2 border-[#D4FF00]'
                        : 'hover:bg-gray-900'
                        }`}
                    >
                      <span className="text-gray-600">{m.move}.</span>
                      <span
                        onClick={() => {
                          const historyIndex = moveHistory.findIndex(h => h.moveIndex === whiteMoveIndex)
                          if (historyIndex >= 0) {
                            setIsViewingHistory(true)
                            setViewingMoveIndex(historyIndex)
                          }
                        }}
                        className={`cursor-pointer hover:text-[#D4FF00] transition-colors ${viewingWhite
                          ? 'text-[#D4FF00] font-bold bg-[#D4FF00]/20 px-1 -mx-1 rounded'
                          : isLatestWhite
                            ? 'text-[#D4FF00]'
                            : 'text-white'
                          }`}
                      >
                        {m.white}
                      </span>
                      <span
                        onClick={() => {
                          if (!m.black) return
                          const historyIndex = moveHistory.findIndex(h => h.moveIndex === blackMoveIndex)
                          if (historyIndex >= 0) {
                            setIsViewingHistory(true)
                            setViewingMoveIndex(historyIndex)
                          }
                        }}
                        className={`cursor-pointer hover:text-[#D4FF00] transition-colors ${viewingBlack
                          ? 'text-[#D4FF00] font-bold bg-[#D4FF00]/20 px-1 -mx-1 rounded'
                          : isLatestBlack
                            ? 'text-[#D4FF00]'
                            : 'text-gray-400'
                          } ${m.black ? '' : 'cursor-default'}`}
                      >
                        {m.black || ''}
                      </span>
                    </div>
                  )
                })}
                {!gameState?.pgn && (
                  <div className="text-center text-gray-600 py-8 text-xs uppercase tracking-widest">
                    No moves yet
                  </div>
                )}
              </div>

              {/* 히스토리 네비게이션 버튼 */}
              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-900">
                <button
                  onClick={goToFirstMove}
                  disabled={moveHistory.length === 0}
                  className="p-1.5 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="처음으로"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M9.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={goToPreviousMove}
                  disabled={moveHistory.length === 0 || (isViewingHistory && viewingMoveIndex <= 0)}
                  className="p-1.5 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="이전 수"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMove}
                  disabled={!isViewingHistory}
                  className="p-1.5 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="다음 수"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={goToLatestMove}
                  disabled={!isViewingHistory}
                  className="p-1.5 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="최신으로"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
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
                <div className="text-[#D4FF00]">
                  <Timer
                    initialTime={myColor === 'white' ? whiteTime : blackTime}
                    isActive={!gameOverData && gameState?.currentTurn === myColor}
                    onTimeout={handleMyTimeout}
                  />
                </div>
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
