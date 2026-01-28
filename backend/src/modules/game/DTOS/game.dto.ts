export interface CreateGameDto {
  whiteUserId: number;
  blackUserId: number;
  whiteDeckId: number;
  blackDeckId: number;
}

export interface GameResponseDto {
  id: number;
  whiteUserId: number;
  blackUserId: number;
  whiteDeckId: number;
  blackDeckId: number;
  status: string;
  createdAt: Date;
}

export interface PlayerInfoDto {
  userId: number;
  username: string;
  rating: number;
  deckId: number;
  color: string;
}

export interface GameStateDto {
  id: number;
  white: PlayerInfoDto;
  black: PlayerInfoDto;
  player1: PlayerInfoDto;
  player2: PlayerInfoDto;
  board: any[][];
  currentTurn: string;
  moveCount: number;
  pgn?: string;
  status: string;
  isCheck: boolean;
  initialFen?: string;
  capturedPieces?: {
    white: string[];
    black: string[];
  };
  playedAt: Date;
  ratingChanges?: {
    white: {
      oldRating: number;
      newRating: number;
      ratingDelta: number;
      pieceScore: number;
    };
    black: {
      oldRating: number;
      newRating: number;
      ratingDelta: number;
      pieceScore: number;
    };
  };
}

export interface GameHistoryDto {
  gameId: number;
  moves: MoveHistoryDto[];
  pgn?: string;
  fen?: string;
}

export interface MoveHistoryDto {
  moveNumber: number;
  white?: {
    uci: string;
    san: string;
    piece: string;
    timestamp: Date;
  };
  black?: {
    uci: string;
    san: string;
    piece: string;
    timestamp: Date;
  };
}

export interface UserGameHistoryDto {
  id: number;
  gameId: number;
  opponent: {
    userId: number;
    username: string;
    rating: number;
  };
  myColor: string;
  result: string;
  reason?: string;
  ratingChange: number;
  deckUsed: {
    id: number;
    name: string;
  };
  moveCount: number;
  duration?: number;
  playedAt: Date;
}

export interface ResignGameDto {
  userId: number;
}

export interface ResignResponseDto {
  result: string;
  reason: string;
  whiteRatingChange: number;
  blackRatingChange: number;
}
