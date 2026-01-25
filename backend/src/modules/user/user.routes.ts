import { Router } from 'express';
import * as userController from './user.controller';
import * as deckController from '../deck/deck.controller';
import * as gameController from '../game/game.controller';

const router = Router();

// POST /api/users - 사용자 생성
router.post('/', userController.createUser);

// GET /api/users/:userId - 사용자 정보 조회
router.get('/:userId', userController.getUserById);

// GET /api/users/:userId/stats - 사용자 통계 조회
router.get('/:userId/stats', userController.getUserStats);

// GET /api/users/:userId/decks - 사용자 덱 목록 조회
router.get('/:userId/decks', deckController.getUserDecks);

// GET /api/users/:userId/games - 사용자 게임 기록 조회
router.get('/:userId/games', gameController.getUserGames);

export default router;