import prisma from '../../utils/prisma';

export const createGame = async (whiteId: number, blackId: number, whiteDeckId: number, blackDeckId: number) => {
  return await prisma.game.create({
    data: {
      white_player_id: whiteId,
      black_player_id: blackId,
      white_deck_id: whiteDeckId,
      black_deck_id: blackDeckId,
      initial_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    }
  });
};

export const findGameById = async (id: number) => {
  return await prisma.game.findUnique({
    where: { id },
    include: {
      user_game_white_player_idTouser: true,
      user_game_black_player_idTouser: true,
      deck_game_white_deck_idTodeck: {
        include: {
          deck_composition: {
            include: { piece: true }
          }
        }
      },
      deck_game_black_deck_idTodeck: {
        include: {
          deck_composition: {
            include: { piece: true }
          }
        }
      }
    }
  });
};

export const updateGameResult = async (gameId: number, result: string, pgn?: string) => {
  return await prisma.game.update({
    where: { id: gameId },
    data: {
      result,
      ...(pgn && { pgn }) // pgn이 있을 때만 업데이트
    }
  });
};

export const findGamesByUserId = async (userId: number, limit?: number, offset?: number, status?: string) => {
  const where: any = {
    OR: [
      { white_player_id: userId },
      { black_player_id: userId }
    ]
  };

  // status 필터 (result 기반)
  if (status === 'finished') {
    where.result = { not: null };
  } else if (status === 'playing') {
    where.result = null;
  }

  return await prisma.game.findMany({
    where,
    include: {
      user_game_white_player_idTouser: true,
      user_game_black_player_idTouser: true,
      deck_game_white_deck_idTodeck: true,
      deck_game_black_deck_idTodeck: true,
      game_history: {
        where: { user_id: userId }
      }
    },
    orderBy: { played_at: 'desc' },
    take: limit,
    skip: offset
  });
};

export const countGamesByUserId = async (userId: number, status?: string) => {
  const where: any = {
    OR: [
      { white_player_id: userId },
      { black_player_id: userId }
    ]
  };

  if (status === 'finished') {
    where.result = { not: null };
  } else if (status === 'playing') {
    where.result = null;
  }

  return await prisma.game.count({ where });
};

export const createGameHistory = async (userId: number, gameId: number, role: string, result: string, ratingChange: number) => {
  return await prisma.game_history.create({
    data: {
      user_id: userId,
      game_id: gameId,
      role,
      result,
      rating_change: ratingChange
    }
  });
};