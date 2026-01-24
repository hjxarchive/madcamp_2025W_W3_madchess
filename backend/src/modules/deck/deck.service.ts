import * as deckRepo from './deck.repository';
import * as pieceRepo from '../piece/piece.repository';
import { CreateDeckDto, UpdateDeckDto, DeckResponseDto, DeckWithPiecesDto, ValidateDeckDto, ValidateDeckResponseDto, PieceInDeckDto } from './DTOS/deck.dto';

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

export const validateDeck = async (composition: { [key: string]: number }): Promise<ValidateDeckResponseDto> => {
  const allPieces = await pieceRepo.findAllPieces();
  const valueMap = new Map<string, number>();
  
  allPieces.forEach((p: any) => {
    valueMap.set(p.action.toLowerCase(), p.value);
  });

  let totalCost = 0;
  let hasKing = false;
  const errors: string[] = [];

  for (const [code, qty] of Object.entries(composition)) {
    const normalizedCode = code.toLowerCase();
    
    // 킹 확인
    if (normalizedCode === 'k') {
      hasKing = true;
    }

    // 비용 계산
    const val = valueMap.get(normalizedCode) || 0;
    totalCost += val * qty;

    // 개수 제한 확인
    const limit = PIECE_LIMITS[normalizedCode];
    if (limit && qty > limit) {
      errors.push(`${normalizedCode.toUpperCase()} 개수 초과: 최대 ${limit}개 (현재 ${qty}개)`);
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
  const validation = await validateDeck(dto.composition);
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
  const composition: { [key: string]: number } = {};
  deck.deck_composition.forEach((dc: any) => {
    composition[dc.piece.action.toLowerCase()] = dc.quantity;
  });

  return {
    id: deck.id,
    userId: deck.user_id,
    name: dto.name,
    composition,
    totalCost: validation.totalCost,
    winCnt: deck.win_cnt,
    loseCnt: deck.lose_cnt,
    winRate: deck.win_cnt + deck.lose_cnt > 0 ? deck.win_cnt / (deck.win_cnt + deck.lose_cnt) : 0,
    createdAt: deck.created_at
  };
};

export const getUserDecks = async (userId: number, sort?: string, limit?: number): Promise<DeckResponseDto[]> => {
  const decks = await deckRepo.findDecksByUser(userId, sort, limit);
  
  return decks.map((deck: any) => {
    const composition: { [key: string]: number } = {};
    let totalCost = 0;

    deck.deck_composition.forEach((dc: any) => {
      const code = dc.piece.action.toLowerCase();
      composition[code] = dc.quantity;
      totalCost += dc.piece.value * dc.quantity;
    });

    const totalGames = deck.win_cnt + deck.lose_cnt;
    const winRate = totalGames > 0 ? deck.win_cnt / totalGames : 0;

    return {
      id: deck.id,
      userId: deck.user_id,
      name: `Deck ${deck.id}`, // name 필드가 없어서 임시
      composition,
      totalCost,
      winCnt: deck.win_cnt,
      loseCnt: deck.lose_cnt,
      winRate: Math.round(winRate * 1000) / 1000,
      createdAt: deck.created_at
    };
  });
};

export const getDeckById = async (deckId: number): Promise<DeckWithPiecesDto> => {
  const deck = await deckRepo.findDeckById(deckId);
  
  if (!deck) {
    throw new Error('DECK_NOT_FOUND');
  }

  const composition: { [key: string]: number } = {};
  let totalCost = 0;
  const pieces: PieceInDeckDto[] = [];

  deck.deck_composition.forEach((dc: any) => {
    const code = dc.piece.action.toLowerCase();
    composition[code] = dc.quantity;
    totalCost += dc.piece.value * dc.quantity;

    pieces.push({
      pieceId: dc.piece.id,
      name: dc.piece.name,
      type: code,
      value: dc.piece.value,
      quantity: dc.quantity,
      action: dc.piece.action,
      imgUrl: dc.piece.img_url || undefined
    });
  });

  const totalGames = deck.win_cnt + deck.lose_cnt;
  const winRate = totalGames > 0 ? deck.win_cnt / totalGames : 0;

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
    id: deck.id,
    userId: deck.user_id,
    name: `Deck ${deck.id}`,
    composition,
    totalCost,
    winCnt: deck.win_cnt,
    loseCnt: deck.lose_cnt,
    winRate: Math.round(winRate * 1000) / 1000,
    createdAt: deck.created_at,
    pieces,
    recentGames
  };
};

export const updateDeck = async (deckId: number, dto: UpdateDeckDto): Promise<DeckResponseDto> => {
  // composition이 변경되는 경우 검증
  if (dto.composition) {
    const validation = await validateDeck(dto.composition);
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

    const composition: { [key: string]: number } = {};
    updatedDeck.deck_composition.forEach((dc: any) => {
      composition[dc.piece.action.toLowerCase()] = dc.quantity;
    });

    return {
      id: updatedDeck.id,
      userId: updatedDeck.user_id,
      name: dto.name || `Deck ${updatedDeck.id}`,
      composition,
      totalCost: validation.totalCost,
      winCnt: updatedDeck.win_cnt,
      loseCnt: updatedDeck.lose_cnt,
      createdAt: updatedDeck.created_at
    };
  }

  // name만 변경하는 경우 (현재 스키마에 name 없음)
  throw new Error('UPDATE_NOT_SUPPORTED');
};

export const removeDeck = async (deckId: number) => {
  try {
    return await deckRepo.deleteDeck(deckId);
  } catch (error) {
    throw new Error('DECK_NOT_FOUND');
  }
};