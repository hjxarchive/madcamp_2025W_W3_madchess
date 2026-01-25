import { Request, Response } from 'express';
import * as gameService from './game.service';

/**
 * @swagger
 * /api/games:
 *   post:
 *     summary: 게임 생성
 *     tags: [Games]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - whiteUserId
 *               - blackUserId
 *               - whiteDeckId
 *               - blackDeckId
 *             properties:
 *               whiteUserId:
 *                 type: number
 *                 description: 백 플레이어 사용자 ID
 *               blackUserId:
 *                 type: number
 *                 description: 흑 플레이어 사용자 ID
 *               whiteDeckId:
 *                 type: number
 *                 description: 백 플레이어 덱 ID
 *               blackDeckId:
 *                 type: number
 *                 description: 흑 플레이어 덱 ID
 *     responses:
 *       201:
 *         description: 게임 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     whiteUserId:
 *                       type: number
 *                     blackUserId:
 *                       type: number
 *                     whiteDeckId:
 *                       type: number
 *                     blackDeckId:
 *                       type: number
 *                     status:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: 서버 오류
 */
export const createGame = async (req: Request, res: Response) => {
  try {
    const game = await gameService.createGame(req.body);
    res.status(201).json({ success: true, data: game });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};

/**
 * @swagger
 * /api/games/{gameId}:
 *   get:
 *     summary: 게임 상태 조회
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 게임 ID
 *     responses:
 *       200:
 *         description: 게임 상태 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     white:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: number
 *                         username:
 *                           type: string
 *                         rating:
 *                           type: number
 *                         deckId:
 *                           type: number
 *                         color:
 *                           type: string
 *                     black:
 *                       type: object
 *                     board:
 *                       type: array
 *                       items:
 *                         type: array
 *                     currentTurn:
 *                       type: string
 *                     moveCount:
 *                       type: number
 *                     pgn:
 *                       type: string
 *                     status:
 *                       type: string
 *                     isCheck:
 *                       type: boolean
 *       404:
 *         description: 게임을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const getGame = async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const game = await gameService.getGameById(gameId);
    res.json({ success: true, data: game });
  } catch (error: any) {
    if (error.message === 'GAME_NOT_FOUND') {
      return res.status(404).json({ 
        success: false, 
        error: { code: 'GAME_NOT_FOUND', message: '게임을 찾을 수 없습니다.' }
      });
    }
    res.status(500).json({ 
      success: false, 
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};

/**
 * @swagger
 * /api/users/{userId}/games:
 *   get:
 *     summary: 사용자 게임 기록 조회
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회 개수 제한
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지네이션 오프셋
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, playing, finished]
 *         description: 게임 상태 필터
 *     responses:
 *       200:
 *         description: 게임 기록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     games:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           opponent:
 *                             type: object
 *                           myColor:
 *                             type: string
 *                           result:
 *                             type: string
 *                           ratingChange:
 *                             type: number
 *                           playedAt:
 *                             type: string
 *                             format: date-time
 *       500:
 *         description: 서버 오류
 */
export const getUserGames = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const status = req.query.status as string;

    const result = await gameService.getUserGames(userId, limit, offset, status);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};

/**
 * @swagger
 * /api/games/{gameId}/resign:
 *   post:
 *     summary: 게임 항복
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 게임 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: number
 *                 description: 항복하는 사용자 ID
 *     responses:
 *       200:
 *         description: 항복 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     result:
 *                       type: string
 *                       example: black_win
 *                     reason:
 *                       type: string
 *                       example: resignation
 *                     whiteRatingChange:
 *                       type: number
 *                       example: -12
 *                     blackRatingChange:
 *                       type: number
 *                       example: 12
 *       400:
 *         description: 게임이 이미 종료됨
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 게임을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const resignGame = async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { userId } = req.body;

    const result = await gameService.resignGame(gameId, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message === 'GAME_NOT_FOUND') {
      return res.status(404).json({ 
        success: false, 
        error: { code: 'GAME_NOT_FOUND', message: '게임을 찾을 수 없습니다.' }
      });
    }
    if (error.message === 'GAME_ENDED') {
      return res.status(400).json({ 
        success: false, 
        error: { code: 'GAME_ENDED', message: '게임이 이미 종료되었습니다.' }
      });
    }
    if (error.message === 'NOT_AUTHORIZED') {
      return res.status(403).json({ 
        success: false, 
        error: { code: 'NOT_AUTHORIZED', message: '권한이 없습니다.' }
      });
    }
    res.status(500).json({ 
      success: false, 
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};