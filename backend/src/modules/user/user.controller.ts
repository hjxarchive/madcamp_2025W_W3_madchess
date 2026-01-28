import { Request, Response } from 'express';
import * as userService from './user.service';

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: 사용자 생성
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: 사용자명 (2-20자, 영문/숫자/언더스코어)
 *                 example: player123
 *     responses:
 *       201:
 *         description: 사용자 생성 성공
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
 *                     username:
 *                       type: string
 *                     rating:
 *                       type: number
 *                       example: 1500
 *                     rd:
 *                       type: number
 *                       example: 350.0
 *                     volatility:
 *                       type: number
 *                       example: 0.06
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 잘못된 요청 (중복 사용자명 또는 유효하지 않은 사용자명)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: USERNAME_TAKEN
 *                     message:
 *                       type: string
 *                       example: 이미 존재하는 사용자명입니다.
 *       500:
 *         description: 서버 오류
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const newUser = await userService.registerUser(req.body);
    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        username: newUser.username,
        rating: newUser.rating,
        rd: newUser.rd,
        volatility: newUser.volatility,
        createdAt: newUser.created_at
      }
    });
  } catch (error: any) {
    if (error.message === 'USERNAME_TAKEN') {
      res.status(400).json({
        success: false,
        error: {
          code: 'USERNAME_TAKEN',
          message: '이미 존재하는 사용자명입니다.'
        }
      });
      return;
    }
    if (error.message === 'INVALID_USERNAME') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '유효하지 않은 사용자명입니다. (2-20자, 영문/숫자/언더스코어)'
        }
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Server Error'
      }
    });
  }
};

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: 사용자 정보 조회
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
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
 *                     username:
 *                       type: string
 *                     rating:
 *                       type: number
 *                     rd:
 *                       type: number
 *                     volatility:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalGames:
 *                           type: number
 *                         wins:
 *                           type: number
 *                         losses:
 *                           type: number
 *                         draws:
 *                           type: number
 *                         winRate:
 *                           type: number
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await userService.getUserById(userId);
    res.json({ success: true, data: user });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.'
        }
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Server Error'
      }
    });
  }
};

/**
 * @swagger
 * /api/users/{userId}/stats:
 *   get:
 *     summary: 사용자 상세 통계 조회
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 사용자 통계 조회 성공
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
 *                     totalGames:
 *                       type: number
 *                     wins:
 *                       type: number
 *                     losses:
 *                       type: number
 *                     draws:
 *                       type: number
 *                     winRate:
 *                       type: number
 *                     currentStreak:
 *                       type: number
 *                     bestStreak:
 *                       type: number
 *                     recentGames:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           opponent:
 *                             type: string
 *                           result:
 *                             type: string
 *                           ratingChange:
 *                             type: number
 *                           playedAt:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const stats = await userService.getUserStats(userId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '사용자를 찾을 수 없습니다.'
        }
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Server Error'
      }
    });
  }
};

/**
 * @swagger
 * /api/users/{userId}:
 *   patch:
 *     summary: 사용자 정보 수정 (닉네임 변경)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: 변경할 사용자명
 *     responses:
 *       200:
 *         description: 수정 성공
 *       400:
 *         description: 잘못된 요청 (중복/유효성)
 *       404:
 *         description: 사용자 없음
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { username } = req.body;

    if (!username) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Username is required' }
      });
      return;
    }

    const updatedUser = await userService.updateUser(userId, username);
    res.json({ success: true, data: updatedUser });
  } catch (error: any) {
    if (error.message === 'USERNAME_TAKEN') {
      res.status(400).json({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: '이미 존재하는 사용자명입니다.' }
      });
      return;
    }
    if (error.message === 'INVALID_USERNAME') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '유효하지 않은 사용자명입니다.' }
      });
      return;
    }
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' }
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: 리더보드 조회
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: 리더보드 조회 성공
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
 *                     players:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rank:
 *                             type: number
 *                           userId:
 *                             type: number
 *                           username:
 *                             type: string
 *                           name:
 *                             type: string
 *                           picture:
 *                             type: string
 *                           rating:
 *                             type: number
 *                           rd:
 *                             type: number
 *                           isProvisional:
 *                             type: boolean
 *                           totalGames:
 *                             type: number
 *                           winRate:
 *                             type: number
 *       500:
 *         description: 서버 오류
 */
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const players = await userService.getLeaderboard();
    res.json({ success: true, data: { players } });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Server Error'
      }
    });
  }
};