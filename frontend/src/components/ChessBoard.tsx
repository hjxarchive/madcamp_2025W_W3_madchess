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
  useImages?: boolean  // 이미지 사용 여부 (기본값: false = 유니코드 사용)
  fetchLegalMoves?: (from: { row: number; col: number; piece: Piece }) => Promise<{ row: number; col: number }[]>  // 백엔드로부터 합법적 수 요청
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
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null)
  const [legalMoves, setLegalMoves] = useState<{ row: number; col: number }[]>([])

  // 보드를 내 색상에 맞게 회전
  const displayBoard = myColor === 'black'
    ? [...board].reverse().map(row => [...row].reverse())
    : board

  const getActualPosition = (displayRow: number, displayCol: number) => {
    if (myColor === 'black') {
      return { row: 7 - displayRow, col: 7 - displayCol }
    }
    return { row: displayRow, col: displayCol }
  }

  const handleSquareClick = async (displayRow: number, displayCol: number) => {
    if (!isMyTurn) return

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
      if (fetchLegalMoves) {
        try {
          const moves = await fetchLegalMoves({ row: actual.row, col: actual.col, piece })
          setLegalMoves(moves)
        } catch (e) {
          console.error('Failed to fetch legal moves', e)
          setLegalMoves([])
        }
      } else {
        setLegalMoves([])
      }
      return
    }

    // 이동 실행
    if (selectedSquare) {
      const isLegalMove = legalMoves.some(
        move => move.row === actual.row && move.col === actual.col
      )

      if (isLegalMove) {
        const movingPiece = board[selectedSquare.row][selectedSquare.col]
        if (movingPiece) {
          const fromSquare = rowColToSquare(selectedSquare.row, selectedSquare.col)
          const toSquare = rowColToSquare(actual.row, actual.col)
          const move: Move = {
            uci: moveToUci(fromSquare, toSquare),
            piece: movingPiece.type,
            captured: piece?.type,
          }
          onMove(move)
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
                      ${kingCheck ? 'bg-red-500' : ''}
                      ${isMyTurn ? 'hover:brightness-90' : 'cursor-not-allowed'}
                    `}
                  >
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

      {/* 턴 표시 */}
      <div className="mt-4 text-center">
        <div className={`
          inline-block px-6 py-2 rounded-lg font-semibold text-lg
          ${isMyTurn ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}
        `}>
          {isMyTurn ? '당신의 차례입니다' : '상대방의 차례입니다'}
        </div>
      </div>
    </div>
  )
}
