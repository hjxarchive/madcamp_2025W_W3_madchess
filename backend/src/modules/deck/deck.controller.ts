import { Request, Response } from 'express';
import * as deckService from './deck.service';

/**
 * @swagger
 * /api/decks:
 *   post:
 *     summary: 덱 생성
 *     tags: [Decks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - name
 *               - composition
 *             properties:
 *               userId:
 *                 type: number
 *                 description: 사용자 ID
 *               name:
 *                 type: string
 *                 description: 덱 이름
 *               composition:
 *                 type: object
 *                 description: 기물 구성 (p=폰, n=나이트, b=비숍, r=룩, q=퀸, k=킹)
 *                 example:
 *                   p: 8
 *                   n: 2
 *                   b: 2
 *                   r: 2
 *                   q: 1
 *                   k: 1
 *     responses:
 *       201:
 *         description: 덱 생성 성공
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
 *                     userId:
 *                       type: number
 *                     name:
 *                       type: string
 *                     composition:
 *                       type: object
 *                     totalCost:
 *                       type: number
 *                     winCnt:
 *                       type: number
 *                     loseCnt:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 잘못된 요청 (킹 필수, 예산 초과, 기물 개수 초과)
 *       500:
 *         description: 서버 오류
 */
export const createDeck = async (req: Request, res: Response) => {
  try {
    const result = await deckService.createDeck(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'KING_REQUIRED') {
      return res.status(400).json({
        success: false,
        error: { code: 'KING_REQUIRED', message: '킹은 필수입니다.' }
      });
    }
    if (err.message === 'BUDGET_EXCEEDED') {
      return res.status(400).json({
        success: false,
        error: { code: 'BUDGET_EXCEEDED', message: '예산(30)을 초과했습니다.' }
      });
    }
    if (err.message === 'PIECE_COUNT_EXCEEDED') {
      return res.status(400).json({
        success: false,
        error: { code: 'PIECE_COUNT_EXCEEDED', message: '기물 개수를 초과했습니다.' }
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
 * /api/users/{userId}/decks:
 *   get:
 *     summary: 사용자 덱 목록 조회
 *     tags: [Decks]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [winRate, recent, name]
 *         description: 정렬 기준
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 조회 개수 제한
 *     responses:
 *       200:
 *         description: 덱 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       userId:
 *                         type: number
 *                       name:
 *                         type: string
 *                       composition:
 *                         type: object
 *                       totalCost:
 *                         type: number
 *                       winCnt:
 *                         type: number
 *                       loseCnt:
 *                         type: number
 *                       winRate:
 *                         type: number
 *       500:
 *         description: 서버 오류
 */
export const getUserDecks = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const sort = req.query.sort as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const data = await deckService.getUserDecks(userId, sort, limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};

/**
 * @swagger
 * /api/decks/{deckId}:
 *   get:
 *     summary: 덱 상세 조회
 *     tags: [Decks]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 덱 ID
 *     responses:
 *       200:
 *         description: 덱 상세 조회 성공
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
 *                     userId:
 *                       type: number
 *                     name:
 *                       type: string
 *                     composition:
 *                       type: object
 *                     totalCost:
 *                       type: number
 *                     winCnt:
 *                       type: number
 *                     loseCnt:
 *                       type: number
 *                     winRate:
 *                       type: number
 *                     pieces:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recentGames:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: 덱을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const getDeckById = async (req: Request, res: Response) => {
  try {
    const deckId = parseInt(req.params.deckId);
    const data = await deckService.getDeckById(deckId);
    res.json({ success: true, data });
  } catch (err: any) {
    if (err.message === 'DECK_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'DECK_NOT_FOUND', message: '덱을 찾을 수 없습니다.' }
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
 * /api/decks/{deckId}:
 *   put:
 *     summary: 덱 수정
 *     tags: [Decks]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 덱 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               composition:
 *                 type: object
 *     responses:
 *       200:
 *         description: 덱 수정 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 덱을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const updateDeck = async (req: Request, res: Response) => {
  try {
    const deckId = parseInt(req.params.deckId);
    const result = await deckService.updateDeck(deckId, req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'DECK_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'DECK_NOT_FOUND', message: '덱을 찾을 수 없습니다.' }
      });
    }
    if (err.message === 'KING_REQUIRED') {
      return res.status(400).json({
        success: false,
        error: { code: 'KING_REQUIRED', message: '킹은 필수입니다.' }
      });
    }
    if (err.message === 'BUDGET_EXCEEDED') {
      return res.status(400).json({
        success: false,
        error: { code: 'BUDGET_EXCEEDED', message: '예산(30)을 초과했습니다.' }
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
 * /api/decks/{deckId}:
 *   delete:
 *     summary: 덱 삭제
 *     tags: [Decks]
 *     parameters:
 *       - in: path
 *         name: deckId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 덱 ID
 *     responses:
 *       200:
 *         description: 덱 삭제 성공
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
 *                     message:
 *                       type: string
 *                       example: 덱이 삭제되었습니다
 *       404:
 *         description: 덱을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const deleteDeck = async (req: Request, res: Response) => {
  try {
    const deckId = parseInt(req.params.deckId);
    await deckService.removeDeck(deckId);
    res.json({
      success: true,
      data: { message: '덱이 삭제되었습니다' }
    });
  } catch (err: any) {
    if (err.message === 'DECK_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'DECK_NOT_FOUND', message: '덱을 찾을 수 없습니다.' }
      });
    }
    if (err.message === 'DECK_IN_USE') {
      return res.status(400).json({
        success: false,
        error: { code: 'DECK_IN_USE', message: '게임 기록이 있는 덱은 삭제할 수 없습니다.' }
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
 * /api/decks/validate:
 *   post:
 *     summary: 덱 검증
 *     tags: [Decks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - composition
 *             properties:
 *               composition:
 *                 type: object
 *                 description: 기물 구성
 *                 example:
 *                   p: 8
 *                   n: 2
 *                   b: 2
 *                   r: 2
 *                   q: 1
 *                   k: 1
 *     responses:
 *       200:
 *         description: 덱 검증 결과
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
 *                     valid:
 *                       type: boolean
 *                     totalCost:
 *                       type: number
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: 서버 오류
 */
export const validateDeck = async (req: Request, res: Response) => {
  try {
    const result = await deckService.validateDeck(req.body.composition);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};