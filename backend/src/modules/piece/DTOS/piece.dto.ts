export interface PieceResponseDto {
    id: number;
    name: string;
    type: string;
    value: number;
    action: string;
    maxCount: number;
    description: string;
    imgUrl?: string;
}

export interface PieceDetailDto extends PieceResponseDto {
    movePattern: number[][];
    specialRules: string[];
}
