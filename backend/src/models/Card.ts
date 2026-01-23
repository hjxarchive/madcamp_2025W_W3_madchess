export interface Card {
  id: string
  name: string
  type: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'
  cost: number
  attack: number
  defense: number
  movement: string
  special?: string
  description?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const defaultCards: Omit<Card, 'id'>[] = [
  {
    name: '보병',
    type: 'pawn',
    cost: 1,
    attack: 1,
    defense: 1,
    movement: 'forward-1',
    rarity: 'common',
    description: '기본 보병 유닛',
  },
  {
    name: '기사',
    type: 'knight',
    cost: 3,
    attack: 3,
    defense: 2,
    movement: 'L-shape',
    rarity: 'rare',
    description: 'L자 이동이 가능한 기사',
  },
  {
    name: '주교',
    type: 'bishop',
    cost: 3,
    attack: 3,
    defense: 2,
    movement: 'diagonal',
    rarity: 'rare',
    description: '대각선 이동이 가능한 주교',
  },
  {
    name: '전차',
    type: 'rook',
    cost: 5,
    attack: 5,
    defense: 3,
    movement: 'straight',
    rarity: 'epic',
    description: '직선 이동이 가능한 강력한 전차',
  },
  {
    name: '여왕',
    type: 'queen',
    cost: 9,
    attack: 9,
    defense: 5,
    movement: 'all-directions',
    rarity: 'legendary',
    description: '모든 방향으로 이동 가능한 최강 유닛',
  },
  {
    name: '왕',
    type: 'king',
    cost: 0,
    attack: 2,
    defense: 10,
    movement: 'one-square',
    rarity: 'legendary',
    description: '게임의 승패를 가르는 왕',
  },
]
