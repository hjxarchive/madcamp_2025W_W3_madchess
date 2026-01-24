import { Router } from 'express';
import * as deckController from './deck.controller';

const router = Router();

// POST /api/decks - 덱 생성
router.post('/', deckController.createDeck);

// GET /api/decks/:deckId - 덱 상세 조회
router.get('/:deckId', deckController.getDeckById);

// PUT /api/decks/:deckId - 덱 수정
router.put('/:deckId', deckController.updateDeck);

// DELETE /api/decks/:deckId - 덱 삭제
router.delete('/:deckId', deckController.deleteDeck);

// POST /api/decks/validate - 덱 검증
router.post('/validate', deckController.validateDeck);

export default router;