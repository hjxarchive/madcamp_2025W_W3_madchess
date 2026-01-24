export interface DeckCompositionMap {
  [actionCode: string]: number; // e.g., { "p": 8, "k": 1 }
}

export interface CreateDeckDto {
  userId: number;
  name: string;
  composition: DeckCompositionMap;
}

export interface UpdateDeckDto {
  name?: string;
  composition?: DeckCompositionMap;
}

export interface DeckResponseDto {
  id: number;
  userId: number;
  name: string;
  composition: DeckCompositionMap;
  totalCost: number;
  winCnt: number;
  loseCnt: number;
  winRate?: number;
  createdAt: Date;
  lastUsed?: Date;
}

export interface DeckWithPiecesDto extends DeckResponseDto {
  pieces: PieceInDeckDto[];
  recentGames?: RecentDeckGameDto[];
}

export interface PieceInDeckDto {
  pieceId: number;
  name: string;
  type: string;
  value: number;
  quantity: number;
  action: string;
  imgUrl?: string;
}

export interface RecentDeckGameDto {
  gameId: number;
  result: string;
  opponent: string;
  playedAt: Date;
}

export interface ValidateDeckDto {
  composition: DeckCompositionMap;
}

export interface ValidateDeckResponseDto {
  valid: boolean;
  totalCost: number;
  errors: string[];
}