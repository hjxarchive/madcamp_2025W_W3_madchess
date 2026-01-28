import * as deckRepo from './deck.repository';
import * as pieceRepo from '../piece/piece.repository';
import { CreateDeckDto, UpdateDeckDto, DeckResponseDto, DeckWithPiecesDto, ValidateDeckDto, ValidateDeckResponseDto, PlacedPieceDto } from './DTOS/deck.dto';

// 기물 제한 (API 명세서 기준)
const PIECE_LIMITS: { [key: string]: number } = {
  'p': 8,  // 폰 최대 8개
  'n': 2,  // 나이트 최대 2개
  'b': 2,  // 비숍 최대 2개
  'r': 2,  // 룩 최대 2개
  'q': 1,  // 퀸 최대 1개
  'k': 1   // 킹 필수 1개
};

const BUDGET = 30; // 예산 제한

// placement 배열을 검증
export const validateDeck = async (placement: PlacedPieceDto[]): Promise<ValidateDeckResponseDto> => {
  const allPieces = await pieceRepo.findAllPieces();
  const valueMap = new Map<string, number>();

  allPieces.forEach((p: any) => {
    valueMap.set(p.action.toLowerCase(), p.value);
  });

  let totalCost = 0;
  let hasKing = false;
  const errors: string[] = [];
  const pieceCounts: { [key: string]: number } = {};

  for (const piece of placement) {
    const normalizedCode = piece.type.toLowerCase();

    // 킹 확인
    if (normalizedCode === 'k') {
      hasKing = true;
    }

    // 개수 카운트
    pieceCounts[normalizedCode] = (pieceCounts[normalizedCode] || 0) + 1;

    // 비용 계산
    const val = valueMap.get(normalizedCode) || 0;
    totalCost += val;
  }

  // 개수 제한 확인
  for (const [code, count] of Object.entries(pieceCounts)) {
    const limit = PIECE_LIMITS[code];
    if (limit && count > limit) {
      errors.push(`${code.toUpperCase()} 개수 초과: 최대 ${limit}개 (현재 ${count}개)`);
    }
  }

  if (!hasKing) {
    errors.push('킹은 필수입니다');
  }

  if (totalCost > BUDGET) {
    errors.push(`예산 초과: ${BUDGET}점 제한 (현재 ${totalCost}점)`);
  }

  return {
    valid: errors.length === 0,
    totalCost,
    errors
  };
};

export const createDeck = async (dto: CreateDeckDto): Promise<DeckResponseDto> => {
  // 1. 덱 검증
  const validation = await validateDeck(dto.placement);
  if (!validation.valid) {
    const errorMsg = validation.errors[0];
    if (errorMsg.includes('킹')) throw new Error('KING_REQUIRED');
    if (errorMsg.includes('예산')) throw new Error('BUDGET_EXCEEDED');
    if (errorMsg.includes('개수')) throw new Error('PIECE_COUNT_EXCEEDED');
    throw new Error('DECK_INVALID');
  }

  // 2. 기물 정보 가져오기
  const allPieces = await pieceRepo.findAllPieces();
  const pieceMap = new Map<string, number>();

  allPieces.forEach((p: any) => {
    pieceMap.set(p.action.toLowerCase(), p.id);
  });

  // 3. 저장
  const deck = await deckRepo.createDeck(dto, pieceMap);
  if (!deck) throw new Error('DECK_CREATION_FAILED');

  // 4. 응답 DTO 생성
  const placement: PlacedPieceDto[] = deck.deck_composition.map((dc: any) => ({
    type: dc.piece.action.toLowerCase(),
    position: dc.position
  }));

  return {
    id: deck.id,
    userId: deck.user_id,
    name: dto.name,
    placement,
    totalCost: validation.totalCost,
    winCnt: deck.win_cnt,
    loseCnt: deck.lose_cnt,
    winRate: deck.win_cnt + deck.lose_cnt > 0 ? deck.win_cnt / (deck.win_cnt + deck.lose_cnt) : 0,
    createdAt: deck.created_at
  };
};

export const getUserDecks = async (userId: number, sort?: string, limit?: number): Promise<DeckResponseDto[]> => {
  const decks = await deckRepo.findDecksByUser(userId, sort, limit);
  const allPieces = await pieceRepo.findAllPieces();
  const valueMap = new Map<string, number>();
  allPieces.forEach((p: any) => {
    valueMap.set(p.action.toLowerCase(), p.value);
  });

  return decks.map((deck: any) => {
    const placement: PlacedPieceDto[] = [];
    let totalCost = 0;

    deck.deck_composition.forEach((dc: any) => {
      const code = dc.piece.action.toLowerCase();
      placement.push({
        type: code,
        position: dc.position
      });
      totalCost += dc.piece.value;
    });

    // Calculate real stats from game history
    let winCnt = 0;
    let loseCnt = 0;

    if (deck.game_game_white_deck_idTodeck) {
      deck.game_game_white_deck_idTodeck.forEach((g: any) => {
        if (g.result === 'white_win') winCnt++;
        else if (g.result === 'black_win') loseCnt++;
      });
    }

    if (deck.game_game_black_deck_idTodeck) {
      deck.game_game_black_deck_idTodeck.forEach((g: any) => {
        if (g.result === 'black_win') winCnt++;
        else if (g.result === 'white_win') loseCnt++;
      });
    }

    const totalGames = winCnt + loseCnt;
    const winRate = totalGames > 0 ? winCnt / totalGames : 0;

    return {
      id: (deck as any).id,
      userId: (deck as any).user_id,
      name: (deck as any).name || `Deck ${(deck as any).id}`,
      placement,
      totalCost,
      winCnt,
      loseCnt,
      winRate: Math.round(winRate * 1000) / 1000,
      createdAt: (deck as any).created_at
    };
  });
};

export const getDeckById = async (deckId: number): Promise<DeckWithPiecesDto> => {
  const deck = await deckRepo.findDeckById(deckId);

  if (!deck) {
    throw new Error('DECK_NOT_FOUND');
  }

  const placement: PlacedPieceDto[] = [];
  let totalCost = 0;

  deck.deck_composition.forEach((dc: any) => {
    const code = dc.piece.action.toLowerCase();
    placement.push({
      type: code,
      position: dc.position
    });
    totalCost += dc.piece.value;
  });

  // Calculate real stats
  let winCnt = 0;
  let loseCnt = 0;

  if (deck.game_game_white_deck_idTodeck) {
    deck.game_game_white_deck_idTodeck.forEach((g: any) => {
      if (g.result === 'white_win') winCnt++;
      else if (g.result === 'black_win') loseCnt++;
    });
  }

  if (deck.game_game_black_deck_idTodeck) {
    deck.game_game_black_deck_idTodeck.forEach((g: any) => {
      if (g.result === 'black_win') winCnt++;
      else if (g.result === 'white_win') loseCnt++;
    });
  }

  const totalGames = winCnt + loseCnt;
  const winRate = totalGames > 0 ? winCnt / totalGames : 0;

  // 최근 게임
  const allGames = [...deck.game_game_white_deck_idTodeck, ...deck.game_game_black_deck_idTodeck];
  const recentGames = allGames.slice(0, 10).map(game => {
    const isWhite = game.white_deck_id === deckId;
    const opponent = isWhite
      ? game.user_game_black_player_idTouser.username
      : game.user_game_white_player_idTouser.username;

    let result = 'unknown';
    if (game.result) {
      if (game.result === 'white_win' && isWhite) result = 'win';
      else if (game.result === 'black_win' && !isWhite) result = 'win';
      else if (game.result === 'draw') result = 'draw';
      else result = 'lose';
    }

    return {
      gameId: game.id,
      result,
      opponent,
      playedAt: game.played_at
    };
  });

  return {
    id: (deck as any).id,
    userId: (deck as any).user_id,
    name: (deck as any).name || `Deck ${(deck as any).id}`,
    placement,
    totalCost,
    winCnt,
    loseCnt,
    winRate: Math.round(winRate * 1000) / 1000,
    createdAt: (deck as any).created_at,
    recentGames
  };
};

export const updateDeck = async (deckId: number, dto: UpdateDeckDto): Promise<DeckResponseDto> => {
  // placement가 변경되는 경우 검증
  if (dto.placement) {
    const validation = await validateDeck(dto.placement);
    if (!validation.valid) {
      const errorMsg = validation.errors[0];
      if (errorMsg.includes('킹')) throw new Error('KING_REQUIRED');
      if (errorMsg.includes('예산')) throw new Error('BUDGET_EXCEEDED');
      if (errorMsg.includes('개수')) throw new Error('PIECE_COUNT_EXCEEDED');
      throw new Error('DECK_INVALID');
    }

    // 기물 맵 생성
    const allPieces = await pieceRepo.findAllPieces();
    const pieceMap = new Map<string, number>();
    allPieces.forEach((p: any) => {
      pieceMap.set(p.action.toLowerCase(), p.id);
    });

    const updatedDeck = await deckRepo.updateDeck(deckId, dto, pieceMap);
    if (!updatedDeck) throw new Error('DECK_NOT_FOUND');

    const placement: PlacedPieceDto[] = updatedDeck.deck_composition.map((dc: any) => ({
      type: dc.piece.action.toLowerCase(),
      position: dc.position
    }));

    return {
      id: updatedDeck.id,
      userId: updatedDeck.user_id,
      name: dto.name || updatedDeck.name || `Deck ${updatedDeck.id}`,
      placement,
      totalCost: validation.totalCost,
      winCnt: updatedDeck.win_cnt,
      loseCnt: updatedDeck.lose_cnt,
      createdAt: updatedDeck.created_at
    };
  }

  // name만 변경하는 경우
  const allPieces = await pieceRepo.findAllPieces();
  const pieceMap = new Map<string, number>();
  allPieces.forEach((p: any) => {
    pieceMap.set(p.action.toLowerCase(), p.id);
  });

  const updatedDeck = await deckRepo.updateDeck(deckId, dto, pieceMap);
  if (!updatedDeck) throw new Error('DECK_NOT_FOUND');

  const placement: PlacedPieceDto[] = updatedDeck.deck_composition.map((dc: any) => ({
    type: dc.piece.action.toLowerCase(),
    position: dc.position
  }));

  let totalCost = 0;
  updatedDeck.deck_composition.forEach((dc: any) => {
    totalCost += dc.piece.value;
  });

  return {
    id: updatedDeck.id,
    userId: updatedDeck.user_id,
    name: dto.name || updatedDeck.name || `Deck ${updatedDeck.id}`,
    placement,
    totalCost,
    winCnt: updatedDeck.win_cnt,
    loseCnt: updatedDeck.lose_cnt,
    createdAt: updatedDeck.created_at
  };
};

export const removeDeck = async (deckId: number) => {
  try {
    return await deckRepo.deleteDeck(deckId);
  } catch (error: any) {
    if (error.code === 'P2003') {
      throw new Error('DECK_IN_USE');
    }
    throw new Error('DECK_NOT_FOUND');
  }
};