import prisma from '../../utils/prisma';
import { CreateDeckDto, UpdateDeckDto, PlacedPieceDto } from './DTOS/deck.dto';

// 덱 생성 (트랜잭션)
export const createDeck = async (data: CreateDeckDto, pieceMap: Map<string, number>) => {
  return await prisma.$transaction(async (tx: any) => {
    // 1. 덱 본체 생성
    const deck = await tx.deck.create({
      data: {
        user_id: data.userId,
        name: data.name || 'Untitled Deck',
        total_p_val: 0,
      },
    });

    // 2. 배치된 기물들 저장 (각 기물의 위치 포함)
    for (const piece of data.placement) {
      const pieceId = pieceMap.get(piece.type.toLowerCase());
      if (pieceId) {
        await tx.deck_composition.create({
          data: {
            deck_id: deck.id,
            piece_id: pieceId,
            position: piece.position,
          },
        });
      }
    }

    // 3. 덱 조회 (composition 포함)
    return await tx.deck.findUnique({
      where: { id: deck.id },
      include: {
        deck_composition: {
          include: { piece: true }
        }
      }
    });
  });
};

export const findDecksByUser = async (userId: number, sort?: string, limit?: number) => {
  const orderBy: any = {};

  if (sort === 'recent') {
    orderBy.created_at = 'desc';
  } else if (sort === 'winRate') {
    orderBy.win_cnt = 'desc';
  }

  return await prisma.deck.findMany({
    where: { user_id: userId },
    include: {
      deck_composition: {
        include: { piece: true }
      }
    },
    orderBy: orderBy,
    take: limit
  });
};

export const findDeckById = async (deckId: number) => {
  return await prisma.deck.findUnique({
    where: { id: deckId },
    include: {
      deck_composition: {
        include: { piece: true }
      },
      user: true,
      game_game_white_deck_idTodeck: {
        take: 10,
        orderBy: { played_at: 'desc' },
        include: {
          user_game_white_player_idTouser: true,
          user_game_black_player_idTouser: true,
        }
      },
      game_game_black_deck_idTodeck: {
        take: 10,
        orderBy: { played_at: 'desc' },
        include: {
          user_game_white_player_idTouser: true,
          user_game_black_player_idTouser: true,
        }
      }
    }
  });
};

export const updateDeck = async (deckId: number, data: UpdateDeckDto, pieceMap?: Map<string, number>) => {
  return await prisma.$transaction(async (tx: any) => {
    // name 업데이트
    if (data.name) {
      await tx.deck.update({
        where: { id: deckId },
        data: { name: data.name }
      });
    }

    // placement 업데이트가 있는 경우
    if (data.placement && pieceMap) {
      // 기존 composition 삭제
      await tx.deck_composition.deleteMany({
        where: { deck_id: deckId }
      });

      // 새로운 placement 생성
      for (const piece of data.placement) {
        const pieceId = pieceMap.get(piece.type.toLowerCase());
        if (pieceId) {
          await tx.deck_composition.create({
            data: {
              deck_id: deckId,
              piece_id: pieceId,
              position: piece.position,
            },
          });
        }
      }
    }

    // 덱 조회 반환
    return await tx.deck.findUnique({
      where: { id: deckId },
      include: {
        deck_composition: {
          include: { piece: true }
        }
      }
    });
  });
};

export const deleteDeck = async (id: number) => {
  return await prisma.deck.delete({ where: { id } });
};