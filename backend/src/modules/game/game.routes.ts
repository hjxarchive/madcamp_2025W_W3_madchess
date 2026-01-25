import { Router } from 'express';
import * as gameController from './game.controller';

const router = Router();

// POST /api/games - 게임 생성
router.post('/', gameController.createGame);

// GET /api/games/:gameId - 게임 상태 조회
router.get('/:gameId', gameController.getGame);

// POST /api/games/:gameId/resign - 게임 항복
router.post('/:gameId/resign', gameController.resignGame);

export default router;