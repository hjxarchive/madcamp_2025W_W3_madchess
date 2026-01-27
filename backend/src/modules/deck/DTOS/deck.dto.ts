export interface PlacedPieceDto {
  type: string;  // piece action code: 'k', 'q', 'r', 'b', 'n', 'p'
  position: string;  // board position: 'e1', 'a2', etc.
}

export interface CreateDeckDto {
  userId: number;
  name: string;
  placement: PlacedPieceDto[];  // Array of pieces with positions
}

export interface UpdateDeckDto {
  name?: string;
  placement?: PlacedPieceDto[];
}

export interface DeckResponseDto {
  id: number;
  userId: number;
  name: string;
  placement: PlacedPieceDto[];  // Return placement with positions
  totalCost: number;
  winCnt: number;
  loseCnt: number;
  winRate?: number;
  createdAt: Date;
  lastUsed?: Date;
}

export interface DeckWithPiecesDto extends DeckResponseDto {
  recentGames?: RecentDeckGameDto[];
}

export interface RecentDeckGameDto {
  gameId: number;
  result: string;
  opponent: string;
  playedAt: Date;
}

export interface ValidateDeckDto {
  placement: PlacedPieceDto[];
}

export interface ValidateDeckResponseDto {
  valid: boolean;
  totalCost: number;
  errors: string[];
}