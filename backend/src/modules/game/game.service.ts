import * as gameRepo from './game.repository';
import * as userRepo from '../user/user.repository';
import { CreateGameDto, GameResponseDto, GameStateDto, UserGameHistoryDto, ResignResponseDto } from './DTOS/game.dto';

export const createGame = async (dto: CreateGameDto): Promise<GameResponseDto> => {
  const game = await gameRepo.createGame(
    dto.whiteUserId,
    dto.blackUserId,
    dto.whiteDeckId,
    dto.blackDeckId
  );

  return {
    id: game.id,
    whiteUserId: game.white_player_id,
    blackUserId: game.black_player_id,
    whiteDeckId: game.white_deck_id,
    blackDeckId: game.black_deck_id,
    status: 'placement', // 초기 상태
    createdAt: game.played_at
  };
};

export const getGameById = async (gameId: number): Promise<GameStateDto> => {
  const game = await gameRepo.findGameById(gameId);

  if (!game) {
    throw new Error('GAME_NOT_FOUND');
  }

  // FEN에서 보드 파싱 (간단한 구현)
  const board = parseFenToBoard(game.initial_fen || '');

  return {
    id: game.id,
    white: {
      userId: game.user_game_white_player_idTouser.id,
      username: game.user_game_white_player_idTouser.username,
      rating: game.user_game_white_player_idTouser.rating,
      deckId: game.white_deck_id,
      color: 'white'
    },
    black: {
      userId: game.user_game_black_player_idTouser.id,
      username: game.user_game_black_player_idTouser.username,
      rating: game.user_game_black_player_idTouser.rating,
      deckId: game.black_deck_id,
      color: 'black'
    },
    board,
    currentTurn: 'white', // FEN에서 파싱 가능
    moveCount: 0, // PGN에서 계산 가능
    pgn: game.pgn || undefined,
    status: game.result ? 'finished' : 'playing',
    isCheck: false, // 체스 엔진으로 계산 필요
    initialFen: game.initial_fen || undefined,
    capturedPieces: {
      white: [],
      black: []
    },
    playedAt: game.played_at
  };
};

export const getUserGames = async (userId: number, limit: number = 20, offset: number = 0, status?: string): Promise<{ total: number; games: UserGameHistoryDto[] }> => {
  const [games, total] = await Promise.all([
    gameRepo.findGamesByUserId(userId, limit, offset, status),
    gameRepo.countGamesByUserId(userId, status)
  ]);

  const gamesDto: UserGameHistoryDto[] = games.map((game: any) => {
    const isWhite = game.white_player_id === userId;
    const opponent = isWhite
      ? game.user_game_black_player_idTouser
      : game.user_game_white_player_idTouser;

    const myDeck = isWhite
      ? game.deck_game_white_deck_idTodeck
      : game.deck_game_black_deck_idTodeck;

    const gameHistory = game.game_history[0];

    let result = 'UNKNOWN';
    if (gameHistory && gameHistory.result) {
      result = gameHistory.result.toUpperCase();
    } else if (game.result) {
      if (game.result === 'white_win' && isWhite) result = 'WIN';
      else if (game.result === 'black_win' && !isWhite) result = 'WIN';
      else if (game.result === 'draw') result = 'DRAW';
      else result = 'LOSE';
    }

    return {
      id: game.id,
      opponent: {
        userId: opponent.id,
        username: opponent.username,
        rating: opponent.rating
      },
      myColor: isWhite ? 'white' : 'black',
      result,
      reason: game.result || undefined,
      ratingChange: gameHistory?.rating_change || 0,
      deckUsed: {
        id: myDeck.id,
        name: `Deck ${myDeck.id}`
      },
      moveCount: 0, // PGN 파싱 필요
      duration: undefined,
      playedAt: game.played_at
    };
  });

  return {
    total,
    games: gamesDto
  };
};

export const resignGame = async (gameId: number, userId: number): Promise<ResignResponseDto> => {
  const game = await gameRepo.findGameById(gameId);

  if (!game) {
    throw new Error('GAME_NOT_FOUND');
  }

  if (game.result) {
    throw new Error('GAME_ENDED');
  }

  // 항복한 유저가 게임에 속하는지 확인
  if (game.white_player_id !== userId && game.black_player_id !== userId) {
    throw new Error('NOT_AUTHORIZED');
  }

  const isWhite = game.white_player_id === userId;
  const result = isWhite ? 'black_win' : 'white_win';

  // 게임 결과 업데이트
  await gameRepo.updateGameResult(gameId, result);

  // 레이팅 변경 계산 (간단한 고정값, 실제로는 Glicko-2 사용)
  const whiteRatingChange = isWhite ? -12 : 12;
  const blackRatingChange = isWhite ? 12 : -12;

  // 게임 히스토리 생성
  await gameRepo.createGameHistory(
    game.white_player_id,
    gameId,
    'white',
    isWhite ? 'lose' : 'win',
    whiteRatingChange
  );

  await gameRepo.createGameHistory(
    game.black_player_id,
    gameId,
    'black',
    isWhite ? 'win' : 'lose',
    blackRatingChange
  );

  // 사용자 레이팅 업데이트
  const whiteUser = await userRepo.findUserById(game.white_player_id);
  const blackUser = await userRepo.findUserById(game.black_player_id);

  if (whiteUser) {
    await userRepo.updateUserRating(
      game.white_player_id,
      whiteUser.rating + whiteRatingChange,
      whiteUser.rd,
      whiteUser.volatility
    );
  }

  if (blackUser) {
    await userRepo.updateUserRating(
      game.black_player_id,
      blackUser.rating + blackRatingChange,
      blackUser.rd,
      blackUser.volatility
    );
  }

  return {
    result,
    reason: 'resignation',
    whiteRatingChange,
    blackRatingChange
  };
};

/**
 * 게임 종료 시 결과를 DB에 저장하는 함수 (소켓 핸들러에서 호출)
 * @param whiteUserId - 백 플레이어 userId (문자열 또는 숫자)
 * @param blackUserId - 흑 플레이어 userId (문자열 또는 숫자)
 * @param whiteDeckId - 백 플레이어 deckId (문자열 또는 숫자)
 * @param blackDeckId - 흑 플레이어 deckId (문자열 또는 숫자)
 * @param winner - 승자 ('white', 'black', 'draw')
 * @param reason - 종료 사유 ('checkmate', 'stalemate', 'resignation', 'placement', 'mutual agreement')
 * @param pgn - PGN 기록 (선택)
 */
export const saveGameResult = async (
  whiteUserId: string | number,
  blackUserId: string | number,
  whiteDeckId: string | number,
  blackDeckId: string | number,
  winner: 'white' | 'black' | 'draw',
  reason: string,
  pgn?: string
): Promise<{ success: boolean; gameId?: number; error?: string }> => {
  try {
    // userId와 deckId를 숫자로 변환
    const whiteId = typeof whiteUserId === 'string' ? parseInt(whiteUserId) : whiteUserId;
    const blackId = typeof blackUserId === 'string' ? parseInt(blackUserId) : blackUserId;
    const whiteDeck = typeof whiteDeckId === 'string' ? parseInt(whiteDeckId) : whiteDeckId;
    const blackDeck = typeof blackDeckId === 'string' ? parseInt(blackDeckId) : blackDeckId;

    // NaN 체크
    if (isNaN(whiteId) || isNaN(blackId)) {
      console.log(`⚠️ Invalid userId: white=${whiteUserId}, black=${blackUserId}`);
      return { success: false, error: 'Invalid userId' };
    }

    // deckId가 없으면 기본값 사용 (1)
    const whiteDeckFinal = isNaN(whiteDeck) ? 1 : whiteDeck;
    const blackDeckFinal = isNaN(blackDeck) ? 1 : blackDeck;

    // 게임 결과 문자열
    let gameResult: string;
    if (winner === 'white') {
      gameResult = 'white_win';
    } else if (winner === 'black') {
      gameResult = 'black_win';
    } else {
      gameResult = 'draw';
    }

    // 1. 게임 레코드 생성
    const game = await gameRepo.createGame(whiteId, blackId, whiteDeckFinal, blackDeckFinal);
    console.log(`📝 Game created: ${game.id}`);

    // 2. 게임 결과 업데이트
    await gameRepo.updateGameResult(game.id, gameResult);

    // 3. 레이팅 변화 계산 (간단한 고정값)
    const whiteRatingChange = winner === 'white' ? 12 : winner === 'black' ? -12 : 0;
    const blackRatingChange = winner === 'black' ? 12 : winner === 'white' ? -12 : 0;

    // 4. 게임 히스토리 생성 (각 플레이어별)
    const whiteResult = winner === 'white' ? 'win' : winner === 'black' ? 'lose' : 'draw';
    const blackResult = winner === 'black' ? 'win' : winner === 'white' ? 'lose' : 'draw';

    await gameRepo.createGameHistory(whiteId, game.id, 'white', whiteResult, whiteRatingChange);
    await gameRepo.createGameHistory(blackId, game.id, 'black', blackResult, blackRatingChange);

    // 5. 사용자 레이팅 업데이트
    const whiteUser = await userRepo.findUserById(whiteId);
    const blackUser = await userRepo.findUserById(blackId);

    if (whiteUser) {
      await userRepo.updateUserRating(
        whiteId,
        whiteUser.rating + whiteRatingChange,
        whiteUser.rd,
        whiteUser.volatility
      );
    }

    if (blackUser) {
      await userRepo.updateUserRating(
        blackId,
        blackUser.rating + blackRatingChange,
        blackUser.rd,
        blackUser.volatility
      );
    }

    console.log(`✅ Game ${game.id} saved: ${gameResult} by ${reason}`);
    console.log(`📊 Rating changes: White ${whiteRatingChange > 0 ? '+' : ''}${whiteRatingChange}, Black ${blackRatingChange > 0 ? '+' : ''}${blackRatingChange}`);

    return { success: true, gameId: game.id };
  } catch (error) {
    console.error('❌ Error saving game result:', error);
    return { success: false, error: String(error) };
  }
};

// 유틸리티 함수: FEN을 보드로 파싱
function parseFenToBoard(fen: string): any[][] {
  const board: any[][] = [];

  if (!fen) {
    return Array(8).fill(null).map(() => Array(8).fill(null));
  }

  const rows = fen.split(' ')[0].split('/');

  for (const row of rows) {
    const boardRow: any[] = [];
    for (const char of row) {
      if (isNaN(Number(char))) {
        // 기물
        const isWhite = char === char.toUpperCase();
        boardRow.push({
          type: char.toLowerCase(),
          color: isWhite ? 'white' : 'black'
        });
      } else {
        // 빈 칸
        const emptyCount = parseInt(char);
        for (let i = 0; i < emptyCount; i++) {
          boardRow.push(null);
        }
      }
    }
    board.push(boardRow);
  }

  return board;
}
