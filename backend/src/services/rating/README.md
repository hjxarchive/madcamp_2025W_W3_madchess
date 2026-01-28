# Glicko-2 Handicap System

MadChess의 기물 점수 핸디캡 시스템입니다. 플레이어가 적은 점수의 기물을 사용할 때 레이팅 보상을 제공합니다.

## 개요

- **최대 기물 점수**: 30점
- **핸디캡 가중치**: 0.3 (조절 가능)
- **기물 가치**: 킹(0), 퀸(9), 룩(5), 비숍(3), 나이트(3), 폰(1)

## 핸디캡 로직

### 기본 원리

1. **적은 기물로 이기면** → 더 많은 레이팅 획득 (변화 없음, 하지만 무승부 시 보상)
2. **적은 기물로 지면** → 레이팅 손실 감소
3. **많은 기물로 이기면** → 레이팅 획득 감소
4. **많은 기물로 지면** → 레이팅 손실 유지 (변화 없음)

### 예상 레이팅 변화 (동일 레이팅 1500, RD=100 기준)

| 기물 점수 (나:상대) | 승리 | 무승부 | 패배 |
|-------------------|------|--------|------|
| 30:30 (동등) | +25.8 | 0.0 | -25.8 |
| 20:30 (불리) | +25.8 | +5.3 | -20.4 |
| 30:20 (유리) | +20.4 | -5.3 | -25.8 |

### 주요 특징

- **무승부의 중요성**: 불리한 기물로 무승부를 만들면 레이팅이 상승
- **공정한 대결 유도**: 강한 기물을 사용할수록 레이팅 획득이 어려워짐
- **전략적 선택**: 플레이어는 레이팅 vs 승률 사이에서 균형을 맞춰야 함

## 사용법

### 1. 기본 사용

```typescript
import {
  calculateHandicapRatingChange,
  HandicapMatchResult,
} from './services/rating/Glicko2Handicap';

// 플레이어와 상대 정보
const player = {
  rating: 1500,
  rd: 100,
  volatility: 0.06,
};

const opponent = {
  rating: 1500,
  rd: 100,
  volatility: 0.06,
};

// 경기 결과 (20점 기물 vs 30점 기물로 승리)
const match: HandicapMatchResult = {
  opponent,
  score: 1.0, // 1.0 = 승리, 0.5 = 무승부, 0.0 = 패배
  playerPieceScore: 20,
  opponentPieceScore: 30,
};

// 레이팅 변화 계산
const result = calculateHandicapRatingChange(player, match);

console.log(`Rating change: ${result.ratingDelta}`);
console.log(`New rating: ${result.newRating}`);
```

### 2. 예상 레이팅 변화 조회

```typescript
import { getExpectedRatingChanges } from './services/rating/Glicko2Handicap';

// 매치 전에 가능한 결과 확인
const expected = getExpectedRatingChanges(
  player,
  opponent,
  20, // 내 기물 점수
  30  // 상대 기물 점수
);

console.log(`승리 시: ${expected.win}`);
console.log(`무승부 시: ${expected.draw}`);
console.log(`패배 시: ${expected.loss}`);
```

### 3. 핸디캡 정보 조회

```typescript
import { getHandicapInfo } from './services/rating/Glicko2Handicap';

const info = getHandicapInfo(player, opponent, 20, 30);

console.log(`기물 점수 차이: ${info.pieceScoreDiff}`);
console.log(`핸디캡 조정값: ${info.handicapModifier}`);
console.log(`기본 예상 승률: ${info.baseExpectedScore}`);
console.log(`조정된 예상 승률: ${info.adjustedExpectedScore}`);
```

### 4. 덱 기물 점수 계산

```typescript
import { calculateTotalPieceScore } from './services/rating/Glicko2Handicap';

// 데이터베이스에서 가져온 덱의 기물들
const deckPieces = [
  { value: 0 },  // King
  { value: 9 },  // Queen
  { value: 5 },  // Rook
  { value: 5 },  // Rook
  { value: 3 },  // Bishop
  { value: 3 },  // Bishop
  { value: 3 },  // Knight
  { value: 1 },  // Pawn
  { value: 1 },  // Pawn
];

const totalScore = calculateTotalPieceScore(
  deckPieces.map(p => p.value)
);

console.log(`Total piece score: ${totalScore}`); // 30
```

## API 레퍼런스

### 인터페이스

#### HandicapMatchResult
```typescript
interface HandicapMatchResult {
  opponent: GlickoPlayer;
  score: number; // 0, 0.5, or 1
  playerPieceScore: number;
  opponentPieceScore: number;
}
```

#### HandicapInfo
```typescript
interface HandicapInfo {
  playerPieceScore: number;
  opponentPieceScore: number;
  pieceScoreDiff: number;
  handicapModifier: number;
  baseExpectedScore: number;
  adjustedExpectedScore: number;
}
```

### 함수

#### calculateHandicapModifier
```typescript
function calculateHandicapModifier(
  playerPieceScore: number,
  opponentPieceScore: number
): number
```
기물 점수 차이를 기반으로 핸디캡 조정값을 계산합니다.

#### getAdjustedScore
```typescript
function getAdjustedScore(
  baseScore: number,
  playerPieceScore: number,
  opponentPieceScore: number
): number
```
핸디캡을 적용한 조정된 스코어를 반환합니다.

#### calculateHandicapRatingChange
```typescript
function calculateHandicapRatingChange(
  player: GlickoPlayer,
  match: HandicapMatchResult
): RatingChange
```
핸디캡이 적용된 레이팅 변화를 계산합니다. **메인 함수입니다.**

#### getExpectedRatingChanges
```typescript
function getExpectedRatingChanges(
  player: GlickoPlayer,
  opponent: GlickoPlayer,
  playerPieceScore: number,
  opponentPieceScore: number
): {
  win: number;
  draw: number;
  loss: number;
  handicapInfo: HandicapInfo;
}
```
승/무/패 각 경우의 예상 레이팅 변화를 반환합니다.

## 설정 조정

핸디캡 가중치를 조정하려면 `Glicko2Handicap.ts` 파일의 상수를 변경하세요:

```typescript
// 기본값: 0.3
export const HANDICAP_WEIGHT = 0.3;

// 더 강한 핸디캡 효과
export const HANDICAP_WEIGHT = 0.5;

// 더 약한 핸디캡 효과
export const HANDICAP_WEIGHT = 0.15;
```

## 테스트

테스트 실행:
```bash
npx tsx src/services/rating/Glicko2Handicap.test.ts
```

## 수학적 배경

핸디캡 시스템은 다음 공식을 사용합니다:

1. **정규화된 기물 점수 차이 계산**:
   ```
   diff = (playerScore - opponentScore) / (MAX - MIN)
   ```

2. **핸디캡 조정값**:
   ```
   modifier = -diff × HANDICAP_WEIGHT
   ```

3. **조정된 스코어**:
   ```
   adjustedScore = clamp(baseScore + modifier, 0, 1)
   ```

4. **Glicko-2 계산**: 조정된 스코어로 표준 Glicko-2 알고리즘 적용

## 다음 단계

프롬프트 4에서 게임 종료 시 레이팅 업데이트 로직을 구현할 예정입니다.
