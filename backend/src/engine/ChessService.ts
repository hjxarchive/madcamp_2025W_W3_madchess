interface Piece {
    type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
    color: 'white' | 'black'
}

interface Position {
    file: number // 0-7 (a-h)
    rank: number // 0-7 (1-8)
}

export class ChessService {
    private board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
    private turn: 'white' | 'black' = 'white'
    private enPassantTarget: Position | null = null
    private halfmoveClock: number = 0  // For fifty-move rule
    private castlingRights = {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true,
    }
    private kingMoved = { white: false, black: false }
    private rookMoved = {
        whiteKingSide: false,
        whiteQueenSide: false,
        blackKingSide: false,
        blackQueenSide: false,
    }
    private moves: string[] = []

    /** Get current turn */
    getTurn(): 'white' | 'black' {
        return this.turn
    }

    getBoard(): (Piece | null)[][] {
        return this.board
    }

    /** Snapshot engine state for reversible simulations */
    private createSnapshot() {
        return {
            board: this.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            turn: this.turn,
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            halfmoveClock: this.halfmoveClock,
            castlingRights: { ...this.castlingRights },
            kingMoved: { ...this.kingMoved },
            rookMoved: { ...this.rookMoved },
            moves: [...this.moves], // Save moves
        }
    }

    /** Restore engine state from snapshot */
    private restoreSnapshot(snapshot: ReturnType<ChessService['createSnapshot']>) {
        this.board = snapshot.board.map(row => row.map(cell => cell ? { ...cell } : null))
        this.turn = snapshot.turn
        this.enPassantTarget = snapshot.enPassantTarget ? { ...snapshot.enPassantTarget } : null
        this.halfmoveClock = snapshot.halfmoveClock
        this.castlingRights = { ...snapshot.castlingRights }
        this.kingMoved = { ...snapshot.kingMoved }
        this.rookMoved = { ...snapshot.rookMoved }
        this.moves = [...snapshot.moves] // Restore moves
    }

    /** Position to UCI helper */
    private positionToUci(pos: Position): string {
        const fileChar = String.fromCharCode('a'.charCodeAt(0) + pos.file)
        const rankChar = (pos.rank + 1).toString()
        return `${fileChar}${rankChar}`
    }

    /**
     * Get available freestyle castling options for a color
     * Returns: array of { rookPos, kingTarget, rookTarget, side }
     */
    getFreestyleCastlingOptions(color: 'white' | 'black'): Array<{
        rookPos: string
        kingPos: string
        kingTarget: string
        rookTarget: string
        side: 'kingside' | 'queenside'
    }> {
        const baseRank = color === 'white' ? 0 : 7
        const castlingOptions: Array<{
            rookPos: string
            kingPos: string
            kingTarget: string
            rookTarget: string
            side: 'kingside' | 'queenside'
        }> = []

        // Find king position
        let kingFile = -1
        for (let file = 0; file < 8; file++) {
            const piece = this.board[baseRank][file]
            if (piece && piece.type === 'k' && piece.color === color) {
                kingFile = file
                break
            }
        }

        if (kingFile === -1 || this.kingMoved[color]) return []
        if (this.isKingInCheck(color)) return []

        const kingPos = this.positionToUci({ file: kingFile, rank: baseRank })

        // Find all unmoved rooks on base rank
        for (let rookFile = 0; rookFile < 8; rookFile++) {
            if (rookFile === kingFile) continue

            const piece = this.board[baseRank][rookFile]
            if (!piece || piece.type !== 'r' || piece.color !== color) continue

            // Check if rook has moved
            const rookMoved = this.hasRookMoved(color, rookFile)
            if (rookMoved) continue

            // Determine side (a-d = queenside, f-h = kingside)
            const side: 'kingside' | 'queenside' = rookFile >= 5 ? 'kingside' : 'queenside'
            const kingTargetFile = side === 'kingside' ? 6 : 2 // g or c file
            const rookTargetFile = side === 'kingside' ? 5 : 3 // f or d file

            // Check if path is clear
            const minFile = Math.min(kingFile, rookFile, kingTargetFile, rookTargetFile)
            const maxFile = Math.max(kingFile, rookFile, kingTargetFile, rookTargetFile)

            let pathClear = true
            for (let file = minFile; file <= maxFile; file++) {
                if (file === kingFile || file === rookFile) continue
                if (this.board[baseRank][file] !== null) {
                    pathClear = false
                    break
                }
            }

            if (!pathClear) continue

            // Check if king's path is not under attack
            const kingPathStart = Math.min(kingFile, kingTargetFile)
            const kingPathEnd = Math.max(kingFile, kingTargetFile)
            let kingPathSafe = true

            for (let file = kingPathStart; file <= kingPathEnd; file++) {
                if (this.isSquareAttacked({ file, rank: baseRank }, color === 'white' ? 'black' : 'white')) {
                    kingPathSafe = false
                    break
                }
            }

            if (!kingPathSafe) continue

            castlingOptions.push({
                rookPos: this.positionToUci({ file: rookFile, rank: baseRank }),
                kingPos,
                kingTarget: this.positionToUci({ file: kingTargetFile, rank: baseRank }),
                rookTarget: this.positionToUci({ file: rookTargetFile, rank: baseRank }),
                side
            })
        }

        return castlingOptions
    }

    private hasRookMoved(color: 'white' | 'black', file: number): boolean {
        // For freestyle castling, track individual rook positions
        // This is a simplified check - you may need to enhance tracking
        if (color === 'white') {
            if (file === 7) return this.rookMoved.whiteKingSide
            if (file === 0) return this.rookMoved.whiteQueenSide
        } else {
            if (file === 7) return this.rookMoved.blackKingSide
            if (file === 0) return this.rookMoved.blackQueenSide
        }
        // For non-standard rook positions, assume not moved initially
        return false
    }

    /**
     * Get all legal moves for a given color (used by clients to filter UI options)
     */
    getLegalMovesForColor(color: 'white' | 'black'): Array<{ from: string; to: string; promotion?: string }> {
        const legalMoves: Array<{ from: string; to: string; promotion?: string }> = []

        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = this.board[rank][file]
                if (!piece || piece.color !== color) continue

                const fromPos: Position = { file, rank }
                const fromUci = this.positionToUci(fromPos)

                for (let toRank = 0; toRank < 8; toRank++) {
                    for (let toFile = 0; toFile < 8; toFile++) {
                        if (toRank === rank && toFile === file) continue

                        const toPos: Position = { file: toFile, rank: toRank }
                        const toUci = this.positionToUci(toPos)

                        // Promotion candidates (default to queen)
                        const promotionNeeded = piece.type === 'p' && (toRank === 0 || toRank === 7)
                        const promotionOptions = promotionNeeded ? ['q'] : [undefined]

                        for (const promo of promotionOptions) {
                            const snapshot = this.createSnapshot()

                            // Force turn to the querying color for validation
                            this.turn = color
                            const result = this.makeMove(fromUci, toUci, promo)

                            // Restore engine state after simulation
                            this.restoreSnapshot(snapshot)

                            if (result.success) {
                                legalMoves.push({ from: fromUci, to: toUci, promotion: promo })
                            }
                        }
                    }
                }
            }
        }

        return legalMoves
    }

    /**
     * UCI notation to position (e.g., "e2" -> {file: 4, rank: 1})
     */
    private uciToPosition(uci: string): Position {
        const file = uci.charCodeAt(0) - 'a'.charCodeAt(0)
        const rank = parseInt(uci[1]) - 1
        return { file, rank }
    }

    /**
     * Check if position is on board
     */
    private isOnBoard(pos: Position): boolean {
        return pos.file >= 0 && pos.file < 8 && pos.rank >= 0 && pos.rank < 8
    }

    /**
     * Get piece at position
     */
    private getPiece(pos: Position): Piece | null {
        if (!this.isOnBoard(pos)) return null
        return this.board[pos.rank][pos.file]
    }

    /**
     * Set piece at position
     */
    private setPiece(pos: Position, piece: Piece | null): void {
        if (this.isOnBoard(pos)) {
            this.board[pos.rank][pos.file] = piece
        }
    }

    /**
     * Check if path is clear (for sliding pieces)
     */
    private isPathClear(from: Position, to: Position): boolean {
        const fileDir = Math.sign(to.file - from.file)
        const rankDir = Math.sign(to.rank - from.rank)

        let current = { file: from.file + fileDir, rank: from.rank + rankDir }

        while (current.file !== to.file || current.rank !== to.rank) {
            if (this.getPiece(current) !== null) return false
            current.file += fileDir
            current.rank += rankDir
        }

        return true
    }

    /**
     * Validate pawn move
     */
    private isValidPawnMove(from: Position, to: Position, piece: Piece): boolean {
        const direction = piece.color === 'white' ? 1 : -1
        const startRank = piece.color === 'white' ? 1 : 6
        const fileDiff = to.file - from.file
        const rankDiff = to.rank - from.rank

        // Forward 1 square
        if (fileDiff === 0 && rankDiff === direction) {
            return this.getPiece(to) === null
        }

        // Forward 2 squares from starting position
        if (fileDiff === 0 && rankDiff === 2 * direction && from.rank === startRank) {
            const middlePos = { file: from.file, rank: from.rank + direction }
            return this.getPiece(to) === null && this.getPiece(middlePos) === null
        }

        // Diagonal capture
        if (Math.abs(fileDiff) === 1 && rankDiff === direction) {
            const target = this.getPiece(to)
            // Regular capture
            if (target && target.color !== piece.color) return true

            // En passant
            if (this.enPassantTarget &&
                to.file === this.enPassantTarget.file &&
                to.rank === this.enPassantTarget.rank) {
                return true
            }
        }

        return false
    }

    /**
     * Validate knight move
     */
    private isValidKnightMove(from: Position, to: Position): boolean {
        const fileDiff = Math.abs(to.file - from.file)
        const rankDiff = Math.abs(to.rank - from.rank)
        return (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2)
    }

    /**
     * Validate bishop move
     */
    private isValidBishopMove(from: Position, to: Position): boolean {
        const fileDiff = Math.abs(to.file - from.file)
        const rankDiff = Math.abs(to.rank - from.rank)
        return fileDiff === rankDiff && fileDiff > 0 && this.isPathClear(from, to)
    }

    /**
     * Validate rook move
     */
    private isValidRookMove(from: Position, to: Position): boolean {
        const fileDiff = Math.abs(to.file - from.file)
        const rankDiff = Math.abs(to.rank - from.rank)
        return (fileDiff === 0 || rankDiff === 0) && (fileDiff + rankDiff > 0) && this.isPathClear(from, to)
    }

    /**
     * Validate queen move
     */
    private isValidQueenMove(from: Position, to: Position): boolean {
        return this.isValidBishopMove(from, to) || this.isValidRookMove(from, to)
    }

    /**
     * Validate king move
     */
    private isValidKingMove(from: Position, to: Position): boolean {
        const fileDiff = Math.abs(to.file - from.file)
        const rankDiff = Math.abs(to.rank - from.rank)

        // Normal king move
        if (fileDiff <= 1 && rankDiff <= 1 && (fileDiff + rankDiff > 0)) {
            return true
        }

        // Castling
        if (rankDiff === 0 && fileDiff === 2) {
            return this.canCastle(from, to)
        }

        return false
    }

    /**
     * Check if castling is valid
     */
    private canCastle(from: Position, to: Position): boolean {
        const piece = this.getPiece(from)
        if (!piece || piece.type !== 'k') return false

        // King must not have moved
        if (this.kingMoved[piece.color]) return false

        // King must not be in check
        if (this.isKingInCheck(piece.color)) return false

        const isKingSide = to.file > from.file
        const rookFile = isKingSide ? 7 : 0
        const rookPos = { file: rookFile, rank: from.rank }
        const rook = this.getPiece(rookPos)

        // Rook must be present and not moved
        if (!rook || rook.type !== 'r' || rook.color !== piece.color) return false
        if (piece.color === 'white') {
            if (isKingSide && this.rookMoved.whiteKingSide) return false
            if (!isKingSide && this.rookMoved.whiteQueenSide) return false
        } else {
            if (isKingSide && this.rookMoved.blackKingSide) return false
            if (!isKingSide && this.rookMoved.blackQueenSide) return false
        }

        // Path must be clear
        if (!this.isPathClear(from, rookPos)) return false

        // Squares king passes through must not be under attack
        const direction = isKingSide ? 1 : -1
        for (let i = 1; i <= 2; i++) {
            const intermediatePos = { file: from.file + i * direction, rank: from.rank }
            if (this.isSquareAttacked(intermediatePos, piece.color === 'white' ? 'black' : 'white')) {
                return false
            }
        }

        return true
    }

    /**
     * Check if a square is attacked by opponent
     */
    private isSquareAttacked(pos: Position, byColor: 'white' | 'black'): boolean {
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = this.board[rank][file]
                if (piece && piece.color === byColor) {
                    const from = { file, rank }
                    if (this.canPieceAttack(from, pos, piece)) {
                        return true
                    }
                }
            }
        }
        return false
    }

    /**
     * Check if a piece can attack a square (ignoring check rules)
     */
    private canPieceAttack(from: Position, to: Position, piece: Piece): boolean {
        switch (piece.type) {
            case 'p':
                const direction = piece.color === 'white' ? 1 : -1
                const fileDiff = Math.abs(to.file - from.file)
                const rankDiff = to.rank - from.rank
                return fileDiff === 1 && rankDiff === direction
            case 'n':
                return this.isValidKnightMove(from, to)
            case 'b':
                return this.isValidBishopMove(from, to)
            case 'r':
                return this.isValidRookMove(from, to)
            case 'q':
                return this.isValidQueenMove(from, to)
            case 'k':
                const kFileDiff = Math.abs(to.file - from.file)
                const kRankDiff = Math.abs(to.rank - from.rank)
                return kFileDiff <= 1 && kRankDiff <= 1 && (kFileDiff + kRankDiff > 0)
            default:
                return false
        }
    }

    /**
     * Find king position
     */
    private findKing(color: 'white' | 'black'): Position | null {
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = this.board[rank][file]
                if (piece && piece.type === 'k' && piece.color === color) {
                    return { file, rank }
                }
            }
        }
        return null
    }

    /**
     * Check if king is in check
     */
    isKingInCheck(color: 'white' | 'black'): boolean {
        const kingPos = this.findKing(color)
        if (!kingPos) return false

        const opponentColor = color === 'white' ? 'black' : 'white'
        return this.isSquareAttacked(kingPos, opponentColor)
    }

    /**
     * Make a move
     */
    makeMove(from: string, to: string, promotion?: string): { success: boolean; isCheck: boolean; isCheckmate: boolean; isStalemate: boolean; isDraw: boolean; drawReason?: string } {
        const fromPos = this.uciToPosition(from)
        const toPos = this.uciToPosition(to)

        console.log(`🔍 makeMove called: ${from} -> ${to}`)
        console.log(`  From position:`, fromPos)
        console.log(`  To position:`, toPos)

        const piece = this.getPiece(fromPos)
        console.log(`  Piece at ${from}:`, piece)
        console.log(`  Current turn:`, this.turn)

        if (!piece) {
            console.log(`  ❌ No piece at ${from}`)
            return { success: false, isCheck: false, isCheckmate: false, isStalemate: false, isDraw: false }
        }

        // Check if it's the right player's turn
        if (piece.color !== this.turn) {
            console.log(`  ❌ Wrong turn. Piece is ${piece.color}, turn is ${this.turn}`)
            return { success: false, isCheck: false, isCheckmate: false, isStalemate: false, isDraw: false }
        }

        // Check if destination has own piece
        const targetPiece = this.getPiece(toPos)
        if (targetPiece && targetPiece.color === piece.color) {
            console.log(`  ❌ Destination has own piece`)
            return { success: false, isCheck: false, isCheckmate: false, isStalemate: false, isDraw: false }
        }

        // Validate move based on piece type
        let isValid = false
        switch (piece.type) {
            case 'p':
                isValid = this.isValidPawnMove(fromPos, toPos, piece)
                break
            case 'n':
                isValid = this.isValidKnightMove(fromPos, toPos)
                break
            case 'b':
                isValid = this.isValidBishopMove(fromPos, toPos)
                break
            case 'r':
                isValid = this.isValidRookMove(fromPos, toPos)
                break
            case 'q':
                isValid = this.isValidQueenMove(fromPos, toPos)
                break
            case 'k':
                isValid = this.isValidKingMove(fromPos, toPos)
                break
        }

        console.log(`  Move validation result: ${isValid}`)

        if (!isValid) {
            return { success: false, isCheck: false, isCheckmate: false, isStalemate: false, isDraw: false }
        }

        // Make the move temporarily to check if it puts own king in check
        const originalTarget = this.getPiece(toPos)
        this.setPiece(toPos, piece)
        this.setPiece(fromPos, null)

        // Check if this move puts own king in check
        if (this.isKingInCheck(piece.color)) {
            // Undo move
            this.setPiece(fromPos, piece)
            this.setPiece(toPos, originalTarget)
            return { success: false, isCheck: false, isCheckmate: false, isStalemate: false, isDraw: false }
        }

        // Move is valid, update game state
        // Handle en passant capture
        if (piece.type === 'p' && this.enPassantTarget &&
            toPos.file === this.enPassantTarget.file &&
            toPos.rank === this.enPassantTarget.rank) {
            const captureRank = piece.color === 'white' ? toPos.rank - 1 : toPos.rank + 1
            this.setPiece({ file: toPos.file, rank: captureRank }, null)
        }

        // Handle castling
        if (piece.type === 'k' && Math.abs(toPos.file - fromPos.file) === 2) {
            const isKingSide = toPos.file > fromPos.file
            const rookFromFile = isKingSide ? 7 : 0
            const rookToFile = isKingSide ? 5 : 3
            const rook = this.getPiece({ file: rookFromFile, rank: fromPos.rank })
            if (rook) {
                this.setPiece({ file: rookToFile, rank: fromPos.rank }, rook)
                this.setPiece({ file: rookFromFile, rank: fromPos.rank }, null)
            }
        }

        // Handle pawn promotion
        if (piece.type === 'p' && (toPos.rank === 7 || toPos.rank === 0)) {
            const promotionPiece = promotion || 'q'
            this.setPiece(toPos, { type: promotionPiece as any, color: piece.color })
        }

        // Update en passant target
        if (piece.type === 'p' && Math.abs(toPos.rank - fromPos.rank) === 2) {
            const direction = piece.color === 'white' ? 1 : -1
            this.enPassantTarget = { file: fromPos.file, rank: fromPos.rank + direction }
        } else {
            this.enPassantTarget = null
        }

        // Update halfmove clock for fifty-move rule
        if (piece.type === 'p' || targetPiece) {
            // Reset on pawn move or capture
            this.halfmoveClock = 0
        } else {
            this.halfmoveClock++
        }

        // Update castling rights
        if (piece.type === 'k') {
            this.kingMoved[piece.color] = true
        }
        if (piece.type === 'r') {
            if (piece.color === 'white') {
                if (fromPos.file === 7) this.rookMoved.whiteKingSide = true
                if (fromPos.file === 0) this.rookMoved.whiteQueenSide = true
            } else {
                if (fromPos.file === 7) this.rookMoved.blackKingSide = true
                if (fromPos.file === 0) this.rookMoved.blackQueenSide = true
            }
        }

        // Switch turn
        this.turn = this.turn === 'white' ? 'black' : 'white'

        // Check for check, checkmate, and stalemate
        const isCheck = this.isKingInCheck(this.turn)
        const isCheckmate = isCheck && this.isCheckmate(this.turn)
        const isStalemate = !isCheck && this.isStalemate(this.turn)

        // Check for draw conditions
        let isDraw = false
        let drawReason: string | undefined = undefined

        // Fifty-move rule
        if (this.halfmoveClock >= 100) {
            isDraw = true
            drawReason = 'fifty-move rule'
        }

        // Insufficient material
        if (!isDraw && this.isInsufficientMaterial()) {
            isDraw = true
            drawReason = 'insufficient material'
        }

        const moveString = promotion ? `${from}${to}${promotion}` : `${from}${to}`
        this.moves.push(moveString)
        console.log(`  ✅ Move completed. Check: ${isCheck}, Checkmate: ${isCheckmate}, Stalemate: ${isStalemate}, Draw: ${isDraw} ${drawReason ? `(${drawReason})` : ''}`)

        return { success: true, isCheck, isCheckmate, isStalemate, isDraw, drawReason }
    }

    /**
     * Check current game state for check/checkmate without making a move
     */
    getCurrentGameState(): { isCheck: boolean; isCheckmate: boolean; isStalemate: boolean } {
        const isCheck = this.isKingInCheck(this.turn)
        const isCheckmate = isCheck && this.isCheckmate(this.turn)
        const isStalemate = !isCheck && this.isStalemate(this.turn)

        console.log(`🔍 Current state check - Turn: ${this.turn}, Check: ${isCheck}, Checkmate: ${isCheckmate}, Stalemate: ${isStalemate}`)

        return { isCheck, isCheckmate, isStalemate }
    }

    /**
     * Check if current player is in checkmate
     */
    isCheckmate(color: 'white' | 'black'): boolean {
        if (!this.isKingInCheck(color)) return false

        // Try all possible moves to see if any can get out of check
        for (let fromRank = 0; fromRank < 8; fromRank++) {
            for (let fromFile = 0; fromFile < 8; fromFile++) {
                const piece = this.board[fromRank][fromFile]
                if (piece && piece.color === color) {
                    for (let toRank = 0; toRank < 8; toRank++) {
                        for (let toFile = 0; toFile < 8; toFile++) {
                            // Try this move
                            const from = { file: fromFile, rank: fromRank }
                            const to = { file: toFile, rank: toRank }

                            // Save state
                            const originalTarget = this.getPiece(to)
                            const originalTurn = this.turn

                            // Try move (simplified check)
                            this.turn = color
                            this.setPiece(to, piece)
                            this.setPiece(from, null)

                            const stillInCheck = this.isKingInCheck(color)

                            // Restore state
                            this.setPiece(from, piece)
                            this.setPiece(to, originalTarget)
                            this.turn = originalTurn

                            if (!stillInCheck) {
                                return false // Found a move that gets out of check
                            }
                        }
                    }
                }
            }
        }

        return true // No move can get out of check
    }

    /**
     * Check if current player is in stalemate (no legal moves but not in check)
     */
    isStalemate(color: 'white' | 'black'): boolean {
        // Must NOT be in check
        if (this.isKingInCheck(color)) return false

        // Check if there are any legal moves
        for (let fromRank = 0; fromRank < 8; fromRank++) {
            for (let fromFile = 0; fromFile < 8; fromFile++) {
                const piece = this.board[fromRank][fromFile]
                if (piece && piece.color === color) {
                    for (let toRank = 0; toRank < 8; toRank++) {
                        for (let toFile = 0; toFile < 8; toFile++) {
                            const from = { file: fromFile, rank: fromRank }
                            const to = { file: toFile, rank: toRank }

                            // Skip if target has own piece
                            const targetPiece = this.getPiece(to)
                            if (targetPiece && targetPiece.color === color) continue

                            // Try to validate the move
                            let isValidPieceMove = false
                            switch (piece.type) {
                                case 'p':
                                    isValidPieceMove = this.isValidPawnMove(from, to, piece)
                                    break
                                case 'n':
                                    isValidPieceMove = this.isValidKnightMove(from, to)
                                    break
                                case 'b':
                                    isValidPieceMove = this.isValidBishopMove(from, to)
                                    break
                                case 'r':
                                    isValidPieceMove = this.isValidRookMove(from, to)
                                    break
                                case 'q':
                                    isValidPieceMove = this.isValidQueenMove(from, to)
                                    break
                                case 'k':
                                    isValidPieceMove = this.isValidKingMove(from, to)
                                    break
                            }

                            if (!isValidPieceMove) continue

                            // Test if move would put own king in check
                            const originalTarget = this.getPiece(to)
                            this.setPiece(to, piece)
                            this.setPiece(from, null)

                            const wouldBeInCheck = this.isKingInCheck(color)

                            // Restore board
                            this.setPiece(from, piece)
                            this.setPiece(to, originalTarget)

                            if (!wouldBeInCheck) {
                                return false // Found a legal move
                            }
                        }
                    }
                }
            }
        }

        return true // No legal moves available
    }

    /**
     * Check if there is insufficient material to checkmate (automatic draw)
     */
    isInsufficientMaterial(): boolean {
        const pieces: { type: string; color: string }[] = []

        // Collect all pieces on the board
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = this.board[rank][file]
                if (piece) {
                    pieces.push(piece)
                }
            }
        }

        // King vs King
        if (pieces.length === 2) {
            return true
        }

        // King + minor piece vs King
        if (pieces.length === 3) {
            const nonKings = pieces.filter(p => p.type !== 'k')
            if (nonKings.length === 1) {
                const piece = nonKings[0]
                // Only bishop or knight (not rook, queen, or pawn)
                if (piece.type === 'b' || piece.type === 'n') {
                    return true
                }
            }
        }

        // King + Bishop vs King + Bishop (same colored squares)
        if (pieces.length === 4) {
            const bishops = pieces.filter(p => p.type === 'b')
            if (bishops.length === 2) {
                // Find bishop positions
                const bishopPositions: Position[] = []
                for (let rank = 0; rank < 8; rank++) {
                    for (let file = 0; file < 8; file++) {
                        const piece = this.board[rank][file]
                        if (piece && piece.type === 'b') {
                            bishopPositions.push({ file, rank })
                        }
                    }
                }

                // Check if both bishops are on same color squares
                if (bishopPositions.length === 2) {
                    const color1 = (bishopPositions[0].file + bishopPositions[0].rank) % 2
                    const color2 = (bishopPositions[1].file + bishopPositions[1].rank) % 2
                    if (color1 === color2) {
                        return true
                    }
                }
            }
        }

        return false
    }

    /**
     * Initialize board from custom placement
     */
    initializeFromPlacement(whitePlacement: any[], blackPlacement: any[]): void {
        // Clear board and moves
        this.board = Array(8).fill(null).map(() => Array(8).fill(null))
        this.moves = []

        // Place white pieces
        whitePlacement.forEach((p: any) => {
            const file = p.file.charCodeAt(0) - 'a'.charCodeAt(0)
            const rank = p.rank - 1
            this.board[rank][file] = { type: p.type, color: 'white' }
        })

        // Place black pieces
        blackPlacement.forEach((p: any) => {
            const file = p.file.charCodeAt(0) - 'a'.charCodeAt(0)
            const rank = p.rank - 1
            this.board[rank][file] = { type: p.type, color: 'black' }
        })

        this.turn = 'white'
    }

    /**
     * Get moves in UCI format space-separated (simple PGN)
     */
    getPGN(): string {
        return this.moves.join(' ')
    }
}
