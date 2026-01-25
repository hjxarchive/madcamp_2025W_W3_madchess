import prisma from '../../utils/prisma';

export const findAllPieces = async () => {
  return await prisma.piece.findMany({
    orderBy: { value: 'asc' }
  });
};

export const findPieceById = async (id: number) => {
  return await prisma.piece.findUnique({ where: { id } });
};