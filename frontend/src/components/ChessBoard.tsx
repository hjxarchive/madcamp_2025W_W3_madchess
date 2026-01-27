import { useState } from 'react'
import { Piece, PieceType, PieceColor, Move, rowColToSquare, squareToRowCol, moveToUci, parseUci } from '../types/game'

interface ChessBoardProps {
  board: (Piece | null)[][]
  currentTurn: PieceColor
  myColor: PieceColor
  isMyTurn: boolean
  lastMove?: Move
  isCheck: boolean
  onMove: (move: Move) => void
  useImages?: boolean
  fetchLegalMoves?: (from: { row: number; col: number; piece: Piece }) => Promise<{ row: number; col: number }[]>
  castlingOptions?: Array<{ rookPos: string; kingPos: string; kingTarget: string; rookTarget: string; side: 'kingside' | 'queenside' }>
  premove?: Move
  onClearPmove?: () => void
}

// 유니코드 체스 기물 심볼
const PIECE_SYMBOLS: Record<PieceColor, Record<PieceType, string>> = {
  white: {
    k: '♔',
    q: '♕',
    r: '♖',
    b: '♗',
    n: '♘',
    p: '♙',
  },
  black: {
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟',
  },
}

// 기물 이미지 URL (예시 - 실제 이미지 경로로 변경 필요)
// 무료 체스 이미지: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
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

// 좌표 라벨
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

export default function ChessBoard({
  board,
  currentTurn,
  myColor,
  isMyTurn,
  lastMove,
  isCheck,
  onMove,
  useImages = false,  // 기본값은 유니코드 심볼 사용
  fetchLegalMoves,
  castlingOptions = [],
  premove,
  onClearPmove,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null)
  const [legalMoves, setLegalMoves] = useState<{ row: number; col: number }[]>([])

  // 보드를 내 색상에 맞게 회전
  const displayBoard = myColor === 'black'
    ? [...board].reverse().map(row => [...row].reverse())
    : board

  // 캐슬링 가능한 룩 위치 확인
  const isCastlingRook = (row: number, col: number): boolean => {
    const square = rowColToSquare(row, col)
    return castlingOptions.some(option => option.rookPos === (square as any))
  }

  const getActualPosition = (displayRow: number, displayCol: number) => {
    if (myColor === 'black') {
      return { row: 7 - displayRow, col: 7 - displayCol }
    }
    return { row: displayRow, col: displayCol }
  }

  const handleSquareClick = async (displayRow: number, displayCol: number) => {
    // If it's not my turn, we support premoves.
    // If it's my turn, we do normal moves.

    const actual = getActualPosition(displayRow, displayCol)
    const piece = board[actual.row][actual.col]

    // 이미 선택된 칸을 다시 클릭하면 선택 해제
    if (selectedSquare && selectedSquare.row === actual.row && selectedSquare.col === actual.col) {
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    // 기물 선택
    if (piece && piece.color === myColor && !selectedSquare) {
      setSelectedSquare(actual)

      // 룩 클릭 시 캐슬링 옵션 확인
      const square = rowColToSquare(actual.row, actual.col)
      const castlingOption = castlingOptions.find(opt => opt.rookPos === (square as any))

      if (castlingOption && piece.type === 'r') {
        // 캐슬링 가능한 룩: 킹의 목적지를 합법수로 표시
        console.log(`♜ Castling option for rook at ${square}: ${castlingOption.side}`)
        const kingTarget = squareToRowCol({
          file: castlingOption.kingTarget[0] as any,
          rank: parseInt(castlingOption.kingTarget[1]) as any
        })
        setLegalMoves([kingTarget])
        return
      }

      // Calculate legal moves
      if (fetchLegalMoves) {
        fetchLegalMoves({ row: actual.row, col: actual.col, piece })
          .then(moves => setLegalMoves(moves))
          .catch(e => {
            console.error('Failed to fetch legal moves', e)
            setLegalMoves([])
          })
      } else {
        // Pseudo-legal moves for premove or if fetchLegalMoves not provided
        // Just show all squares not occupied by own pieces
        const possibleMoves: { row: number; col: number }[] = []
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const targetPiece = board[r][c]
            if (!targetPiece || targetPiece.color !== piece.color) {
              possibleMoves.push({ row: r, col: c })
            }
          }
        }
        setLegalMoves(possibleMoves)
      }
      return
    }

    // 이동 실행
    if (selectedSquare) {
      // Check if clicked square is in legal moves
      const isLegalMove = legalMoves.some(
        move => move.row === actual.row && move.col === actual.col
      )

      if (isLegalMove) {
        const movingPiece = board[selectedSquare.row][selectedSquare.col]
        if (movingPiece) {
          const fromSquare = rowColToSquare(selectedSquare.row, selectedSquare.col)
          const toSquare = rowColToSquare(actual.row, actual.col)

          // 캐슬링 체크: 룩을 선택하고 킹의 목적지를 클릭한 경우
          const selectedSquareUci = rowColToSquare(selectedSquare.row, selectedSquare.col)
          const castlingOpt = castlingOptions.find(opt => opt.rookPos === (selectedSquareUci as any))

          if (castlingOpt && movingPiece.type === 'r') {
            // 캐슬링 실행: 킹 이동으로 변환
            console.log(`♜ Executing castling: ${castlingOpt.side}`)
            const kingMove: Move = {
              uci: `${castlingOpt.kingPos}${castlingOpt.kingTarget}`,
              piece: 'k',
            }
            onMove(kingMove)
          } else {
            // 일반 이동
            const move: Move = {
              uci: moveToUci(fromSquare, toSquare),
              piece: movingPiece.type,
              captured: piece?.type,
            }
            onMove(move)
          }
        }
      }

      setSelectedSquare(null)
      setLegalMoves([])
    }
  }

  const isSquareSelected = (displayRow: number, displayCol: number) => {
    if (!selectedSquare) return false
    const actual = getActualPosition(displayRow, displayCol)
    return selectedSquare.row === actual.row && selectedSquare.col === actual.col
  }

  const isSquareLegalMove = (displayRow: number, displayCol: number) => {
    const actual = getActualPosition(displayRow, displayCol)
    return legalMoves.some(move => move.row === actual.row && move.col === actual.col)
  }

  const isSquareCapture = (displayRow: number, displayCol: number) => {
    const actual = getActualPosition(displayRow, displayCol)
    const isLegal = legalMoves.some(move => move.row === actual.row && move.col === actual.col)
    const piece = board[actual.row][actual.col]
    return isLegal && piece !== null && piece.color !== myColor
  }

  const isSquareLastMove = (displayRow: number, displayCol: number) => {
    if (!lastMove) return false
    const actual = getActualPosition(displayRow, displayCol)
    const { from, to } = parseUci(lastMove.uci)
    const fromPos = squareToRowCol(from)
    const toPos = squareToRowCol(to)
    return (
      (fromPos.row === actual.row && fromPos.col === actual.col) ||
      (toPos.row === actual.row && toPos.col === actual.col)
    )
  }

  const isKingInCheck = (displayRow: number, displayCol: number) => {
    if (!isCheck) return false
    const actual = getActualPosition(displayRow, displayCol)
    const piece = board[actual.row][actual.col]
    return piece?.type === 'k' && piece.color === currentTurn
  }

  const isSquarePremove = (displayRow: number, displayCol: number) => {
    if (!premove) return false
    const actual = getActualPosition(displayRow, displayCol)
    const { from, to } = parseUci(premove.uci)
    const fromPos = squareToRowCol(from)
    const toPos = squareToRowCol(to)
    return (
      (fromPos.row === actual.row && fromPos.col === actual.col) ||
      (toPos.row === actual.row && toPos.col === actual.col)
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* 상단 좌표 (파일) */}
      <div className="flex mb-1">
        <div className="w-8"></div>
        {FILES.map((file, i) => (
          <div
            key={file}
            className="w-16 h-6 flex items-center justify-center text-sm font-semibold text-gray-400"
          >
            {myColor === 'black' ? FILES[7 - i] : file}
          </div>
        ))}
        <div className="w-8"></div>
      </div>

      {/* 체스보드 */}
      <div className="flex">
        {/* 좌측 좌표 (랭크) */}
        <div className="flex flex-col justify-center">
          {RANKS.map((rank, i) => (
            <div
              key={rank}
              className="w-8 h-16 flex items-center justify-center text-sm font-semibold text-gray-400"
            >
              {myColor === 'black' ? RANKS[7 - i] : rank}
            </div>
          ))}
        </div>

        {/* 보드 */}
        <div className="border-4 border-gray-700 shadow-2xl">
          {displayBoard.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((piece, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0
                const selected = isSquareSelected(rowIndex, colIndex)
                const legalMove = isSquareLegalMove(rowIndex, colIndex)
                const isCapture = isSquareCapture(rowIndex, colIndex)
                const lastMoveHighlight = isSquareLastMove(rowIndex, colIndex)
                const kingCheck = isKingInCheck(rowIndex, colIndex)
                const castlingRook = isCastlingRook(rowIndex, colIndex) && isMyTurn
                const premoveHighlight = isSquarePremove(rowIndex, colIndex)

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    className={`
                      w-16 h-16 flex items-center justify-center cursor-pointer
                      transition-all duration-200 relative
                      ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                      ${selected ? 'ring-4 ring-blue-500 ring-inset' : ''}
                      ${lastMoveHighlight ? 'bg-yellow-300' : ''}
                      ${premoveHighlight ? 'bg-red-400/50' : ''}
                      ${kingCheck ? 'bg-red-500' : ''}
                      ${castlingRook ? 'ring-4 ring-green-400 ring-inset' : ''}
                      ${isMyTurn || true ? 'hover:brightness-90' : 'cursor-not-allowed'}
                    `}
                  >
                    {/* 체크된 왕 하이라이트 - 칸 전체 붉은 오버레이 */}
                    {kingCheck && (
                      <div className="absolute inset-0 bg-red-600/80 animate-pulse" />
                    )}

                    {/* 캐슬링 가능한 룩 표시 */}
                    {castlingRook && (
                      <div className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    )}

                    {/* 합법적인 이동 표시 - 빈 칸에만 초록 점 */}
                    {legalMove && !isCapture && !piece && (
                      <div className="absolute w-4 h-4 rounded-full bg-green-500 bg-opacity-70" />
                    )}

                    {/* 캡처 가능한 칸 표시 (기물을 둘러싼) */}
                    {isCapture && (
                      <div className="absolute w-14 h-14 rounded-full border-[3px] border-red-500 opacity-90" style={{ pointerEvents: 'none' }} />
                    )}

                    {/* 기물 */}
                    {piece && (
                      useImages ? (
                        <img
                          src={PIECE_IMAGES[piece.color][piece.type]}
                          alt={`${piece.color} ${piece.type}`}
                          className="w-12 h-12 select-none relative z-10 pointer-events-none"
                          draggable={false}
                        />
                      ) : (
                        <span
                          className={`
                            text-5xl select-none relative z-10
                            ${piece.color === 'white' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'}
                          `}
                        >
                          {PIECE_SYMBOLS[piece.color][piece.type]}
                        </span>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* 우측 좌표 (랭크) */}
        <div className="flex flex-col justify-center">
          {RANKS.map((rank, i) => (
            <div
              key={rank}
              className="w-8 h-16 flex items-center justify-center text-sm font-semibold text-gray-400"
            >
              {myColor === 'black' ? RANKS[7 - i] : rank}
            </div>
          ))}
        </div>
      </div>

      {/* 하단 좌표 (파일) */}
      <div className="flex mt-1">
        <div className="w-8"></div>
        {FILES.map((file, i) => (
          <div
            key={file}
            className="w-16 h-6 flex items-center justify-center text-sm font-semibold text-gray-400"
          >
            {myColor === 'black' ? FILES[7 - i] : file}
          </div>
        ))}
        <div className="w-8"></div>
      </div>
    </div>
  )
}
