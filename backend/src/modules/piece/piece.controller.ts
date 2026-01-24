import { Request, Response } from 'express';
import * as pieceService from './piece.service';

/**
 * @swagger
 * /api/pieces:
 *   get:
 *     summary: 전체 기물 목록 조회
 *     tags: [Pieces]
 *     responses:
 *       200:
 *         description: 기물 목록 조회 성공
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
 *                       name:
 *                         type: string
 *                         example: 폰
 *                       type:
 *                         type: string
 *                         example: p
 *                       value:
 *                         type: number
 *                         example: 1
 *                       action:
 *                         type: string
 *                         example: fWcfF
 *                       maxCount:
 *                         type: number
 *                         example: 8
 *                       description:
 *                         type: string
 *                         example: 전방 1칸 이동, 대각선 캡처
 *                       imgUrl:
 *                         type: string
 *       500:
 *         description: 서버 오류
 */
export const getPieces = async (req: Request, res: Response) => {
  try {
    const data = await pieceService.getAllPieces();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};

/**
 * @swagger
 * /api/pieces/{pieceId}:
 *   get:
 *     summary: 기물 상세 정보 조회
 *     tags: [Pieces]
 *     parameters:
 *       - in: path
 *         name: pieceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 기물 ID
 *     responses:
 *       200:
 *         description: 기물 상세 정보 조회 성공
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
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     value:
 *                       type: number
 *                     action:
 *                       type: string
 *                     maxCount:
 *                       type: number
 *                     description:
 *                       type: string
 *                     imgUrl:
 *                       type: string
 *                     movePattern:
 *                       type: array
 *                       items:
 *                         type: array
 *                         items:
 *                           type: number
 *                     specialRules:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: 기물을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
export const getPieceDetail = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.pieceId);
    const data = await pieceService.getPieceById(id);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error.message === 'PIECE_NOT_FOUND') {
      return res.status(404).json({ 
        success: false, 
        error: { code: 'PIECE_NOT_FOUND', message: '기물을 찾을 수 없습니다.' }
      });
    }
    res.status(500).json({ 
      success: false, 
      error: { code: 'DATABASE_ERROR', message: 'Server Error' }
    });
  }
};