import prisma from '../../utils/prisma';
import { CreateUserDto } from './DTOS/user.dto';

export const createUser = async (data: CreateUserDto) => {
  return await prisma.user.create({
    data: {
      username: data.username,
      rating: 1500,
      rd: 350.0,
      volatility: 0.06
    },
  });
};

export const findUserByUsername = async (username: string) => {
  return await prisma.user.findUnique({
    where: { username }
  });
};

export const findUserById = async (userId: number) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      game_history: {
        include: {
          game: {
            include: {
              user_game_white_player_idTouser: true,
              user_game_black_player_idTouser: true,
              deck_game_white_deck_idTodeck: true,
              deck_game_black_deck_idTodeck: true,
            }
          }
        },
        orderBy: {
          game: {
            played_at: 'desc'
          }
        }
      }
    }
  });
};

export const getUserStats = async (userId: number) => {
  const gameHistory = await prisma.game_history.findMany({
    where: { user_id: userId },
    include: {
      game: {
        include: {
          user_game_white_player_idTouser: true,
          user_game_black_player_idTouser: true,
          deck_game_white_deck_idTodeck: true,
          deck_game_black_deck_idTodeck: true
        }
      }
    },
    orderBy: {
      game: {
        played_at: 'desc'
      }
    }
  });

  return gameHistory;
};

export const updateUserRating = async (
  userId: number,
  newRating: number,
  newRd: number,
  newVolatility: number
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      rating: newRating,
      rd: newRd,
      volatility: newVolatility
    }
  });
};

export const updateUser = async (userId: number, data: { username?: string, picture?: string }) => {
  return await prisma.user.update({
    where: { id: userId },
    data
  });
};