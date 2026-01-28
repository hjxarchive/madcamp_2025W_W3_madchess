export interface CreateUserDto {
  username: string;
}

export interface UserResponseDto {
  id: number;
  username: string;
  rating: number;
  rd: number;
  volatility: number;
  picture?: string;
  createdAt: Date;
}

export interface UserStatsDto {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  favoriteDeck: string;
  recentGames: RecentGameDto[];
}

export interface RecentGameDto {
  id: number;
  opponent: string;
  result: string;
  ratingChange: number;
  playedAt: Date;
}

export interface UserWithStatsDto extends UserResponseDto {
  stats: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  };
}