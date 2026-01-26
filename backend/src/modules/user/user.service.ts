import * as userRepo from './user.repository';
import { CreateUserDto, UserStatsDto, RecentGameDto, UserWithStatsDto } from './DTOS/user.dto';

export const registerUser = async (dto: CreateUserDto) => {
  // 사용자명 검증 (2-20자, 영문/숫자/언더스코어)
  const usernameRegex = /^[a-zA-Z0-9_]{2,20}$/;
  if (!usernameRegex.test(dto.username)) {
    throw new Error('INVALID_USERNAME');
  }

  // 중복 체크
  const existingUser = await userRepo.findUserByUsername(dto.username);
  if (existingUser) {
    throw new Error('USERNAME_TAKEN');
  }

  // 생성
  return await userRepo.createUser(dto);
};

export const getUserById = async (userId: number): Promise<UserWithStatsDto> => {
  const user = await userRepo.findUserById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // 통계 계산
  const totalGames = user.game_history.length;
  const wins = user.game_history.filter((gh: any) => gh.result === 'win').length;
  const losses = user.game_history.filter((gh: any) => gh.result === 'lose').length;
  const draws = user.game_history.filter((gh: any) => gh.result === 'draw').length;
  const winRate = totalGames > 0 ? wins / totalGames : 0;

  return {
    id: user.id,
    username: user.username,
    rating: user.rating,
    rd: user.rd,
    volatility: user.volatility,
    createdAt: user.created_at,
    stats: {
      totalGames,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 1000) / 1000
    }
  };
};

export const getUserStats = async (userId: number): Promise<UserStatsDto> => {
  const user = await userRepo.findUserById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const gameHistory = user.game_history;
  const totalGames = gameHistory.length;
  const wins = gameHistory.filter((gh: any) => gh.result === 'win').length;
  const losses = gameHistory.filter((gh: any) => gh.result === 'lose').length;
  const draws = gameHistory.filter((gh: any) => gh.result === 'draw').length;
  const winRate = totalGames > 0 ? wins / totalGames : 0;

  // 연승 계산
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < gameHistory.length; i++) {
    if (gameHistory[i].result === 'win') {
      tempStreak++;
      if (i === 0) currentStreak = tempStreak;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      if (i === 0) currentStreak = 0;
      tempStreak = 0;
    }
  }

  // 최근 게임 (최대 10개)
  const recentGames: RecentGameDto[] = gameHistory.slice(0, 10).map((gh: any) => {
    const isWhite = gh.game.white_player_id === userId;
    const opponent = isWhite
      ? gh.game.user_game_black_player_idTouser.username
      : gh.game.user_game_white_player_idTouser.username;

    return {
      id: gh.game.id,
      opponent,
      result: gh.result || 'unknown',
      ratingChange: gh.rating_change || 0,
      playedAt: gh.game.played_at
    };
  });

  return {
    totalGames,
    wins,
    losses,
    draws,
    winRate: Math.round(winRate * 1000) / 1000,
    currentStreak,
    bestStreak,
    recentGames
  };
};

export const updateUser = async (userId: number, username: string): Promise<UserWithStatsDto> => {
  // 사용자명 검증 (2-20자, 영문/숫자/언더스코어)
  const usernameRegex = /^[a-zA-Z0-9_]{2,20}$/;
  if (!usernameRegex.test(username)) {
    throw new Error('INVALID_USERNAME');
  }

  // 중복 체크
  const existingUser = await userRepo.findUserByUsername(username);
  if (existingUser && existingUser.id !== userId) {
    throw new Error('USERNAME_TAKEN');
  }

  // 업데이트
  await userRepo.updateUser(userId, { username });

  // 업데이트된 정보 반환
  return await getUserById(userId);
};