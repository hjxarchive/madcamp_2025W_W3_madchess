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
    
    let result = 'unknown';
    if (gameHistory && gameHistory.result) {
      result = gameHistory.result;
    } else if (game.result) {
      if (game.result === 'white_win' && isWhite) result = 'win';
      else if (game.result === 'black_win' && !isWhite) result = 'win';
      else if (game.result === 'draw') result = 'draw';
      else result = 'lose';
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
