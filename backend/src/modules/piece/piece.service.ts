import * as pieceRepo from './piece.repository';
import { PieceResponseDto, PieceDetailDto } from './DTOS/piece.dto';

// 기물 제한 매핑
const PIECE_MAX_COUNT: { [key: string]: number } = {
  'p': 8,
  'n': 2,
  'b': 2,
  'r': 2,
  'q': 1,
  'k': 1
};

// 기물 설명 매핑
const PIECE_DESCRIPTIONS: { [key: string]: string } = {
  'p': '전방 1칸 이동, 대각선 캡처',
  'n': 'L자 이동 (2+1)',
  'b': '대각선 이동',
  'r': '수평/수직 이동',
  'q': '모든 방향 이동',
  'k': '1칸 이동 (필수)'
};

// 기물 이동 패턴
const PIECE_MOVE_PATTERNS: { [key: string]: number[][] } = {
  'n': [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ],
  'k': [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ]
};

export const getAllPieces = async (): Promise<PieceResponseDto[]> => {
  const pieces = await pieceRepo.findAllPieces();
  
  return pieces.map((piece: any) => {
    const type = piece.action.toLowerCase();
    
    return {
      id: piece.id,
      name: piece.name,
      type: type,
      value: piece.value,
      action: piece.action,
      maxCount: PIECE_MAX_COUNT[type] || 0,
      description: PIECE_DESCRIPTIONS[type] || '',
      imgUrl: piece.img_url || undefined
    };
  });
};

export const getPieceById = async (pieceId: number): Promise<PieceDetailDto> => {
  const piece = await pieceRepo.findPieceById(pieceId);
  
  if (!piece) {
    throw new Error('PIECE_NOT_FOUND');
  }

  const type = piece.action.toLowerCase();
  
  return {
    id: piece.id,
    name: piece.name,
    type: type,
    value: piece.value,
    action: piece.action,
    maxCount: PIECE_MAX_COUNT[type] || 0,
    description: PIECE_DESCRIPTIONS[type] || '',
    imgUrl: piece.img_url || undefined,
    movePattern: PIECE_MOVE_PATTERNS[type] || [],
    specialRules: []
  };
};
