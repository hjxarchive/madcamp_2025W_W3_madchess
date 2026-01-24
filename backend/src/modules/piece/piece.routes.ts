import { Router } from 'express';
import * as pieceController from './piece.controller';

const router = Router();
router.get('/', pieceController.getPieces);
router.get('/:pieceId', pieceController.getPieceDetail);
export default router;