# Rating Service Integration Guide

## 개요

Glicko-2 레이팅 시스템이 MadChess 게임 로직에 통합되었습니다.

## 변경 사항

### 1. RatingService 클래스

위치: `backend/src/services/RatingService.ts`

**주요 메서드:**
- `updateRatingsAfterMatch()`: 게임 종료 후 레이팅 업데이트
- `getPlayerRating()`: 플레이어의 현재 레이팅 조회 (비활동 RD 증가 포함)
- `calculateDeckPieceScore()`: 덱의 총 기물 점수 계산
- `updateInactivePlayersRd()`: 비활동 유저 RD 업데이트 (배치 작업용)

### 2. Socket Handler 통합

위치: `backend/src/socket/handlers.ts`

**수정된 이벤트 핸들러:**
- `declare-game-end`: 체크메이트/스테일메이트
- `resign`: 기권
- `timeout`: 시간 초과
- `respond-draw`: 무승부 합의

**모든 핸들러에서:**
1. 기물 점수 계산
2. Glicko-2 핸디캡 레이팅 업데이트
3. DB에 레이팅 변화 저장
4. 클라이언트에 레이팅 변화 전송

### 3. game-over 이벤트 확장

기존:
```typescript
io.to(matchId).emit('game-over', {
  winner: 'white',
  reason: 'checkmate'
})
```

새로운 형식:
```typescript
io.to(matchId).emit('game-over', {
  winner: 'white',
  reason: 'checkmate',
  ratingChanges: {
    white: {
      oldRating: 1500.0,
      newRating: 1516.5,
      change: 16.5
    },
    black: {
      oldRating: 1500.0,
      newRating: 1483.5,
      change: -16.5
    }
  }
})
```

### 4. 데이터베이스 저장

**Game 테이블:**
- `rating_changes` (JSON): 양쪽 플레이어의 레이팅 변화 상세 정보

**User 테이블:**
- `rating` (Float): 업데이트된 레이팅
- `rating_deviation` (Float): 업데이트된 RD
- `volatility` (Float): 업데이트된 volatility
- `last_game_at` (DateTime): 게임 시간 기록

**GameHistory 테이블:**
- `rating_change` (Float): 레이팅 변화량
- `piece_score` (Int): 사용한 기물 점수

## 사용 예시

### 서버에서 레이팅 업데이트

```typescript
import { ratingService } from '../services/RatingService';

// 게임 종료 시
const ratingResult = await ratingService.updateRatingsAfterMatch(
  matchId,
  winnerId, // null for draw
  {
    userId: whitePlayer.userId,
    pieceScore: whitePieceScore,
    deckId: whiteDeckId
  },
  {
    userId: blackPlayer.userId,
    pieceScore: blackPieceScore,
    deckId: blackDeckId
  },
  pgn // optional
);

if (ratingResult.success) {
  console.log(`White: ${ratingResult.white.oldRating} → ${ratingResult.white.newRating}`);
  console.log(`Black: ${ratingResult.black.oldRating} → ${ratingResult.black.newRating}`);
}
```

### 클라이언트에서 레이팅 변화 처리

```typescript
socket.on('game-over', (data) => {
  console.log(`Winner: ${data.winner}`);
  console.log(`Reason: ${data.reason}`);
  
  if (data.ratingChanges) {
    const { white, black } = data.ratingChanges;
    
    // UI 업데이트
    updatePlayerRating('white', white.oldRating, white.newRating, white.change);
    updatePlayerRating('black', black.oldRating, black.newRating, black.change);
  }
});
```

## 레이팅 계산 흐름

1. **게임 종료 감지**
   - 체크메이트, 스테일메이트, 기권, 시간 초과, 무승부 합의

2. **기물 점수 계산**
   - 각 플레이어의 덱에서 기물 점수 계산
   - 데이터베이스에서 piece.value 조회

3. **레이팅 조회**
   - 현재 플레이어 레이팅 조회
   - 비활동 기간 있으면 RD 증가 적용

4. **Glicko-2 계산**
   - 핸디캡 적용된 스코어 계산
   - Glicko-2 알고리즘으로 새 레이팅 계산

5. **데이터베이스 업데이트**
   - User: rating, rating_deviation, volatility, last_game_at
   - Game: rating_changes (JSON)
   - GameHistory: rating_change, piece_score

6. **클라이언트 전송**
   - game-over 이벤트에 ratingChanges 포함

## 배치 작업

비활동 유저의 RD를 주기적으로 업데이트하려면:

```typescript
import { ratingService } from './services/RatingService';

// 매일 실행 (cron job 등)
await ratingService.updateInactivePlayersRd();
```

## 핸디캡 효과 예시

동일 레이팅 (1500), RD=100 기준:

| 기물 점수 | 승리 | 무승부 | 패배 |
|-----------|------|--------|------|
| 30 vs 30 | +25.8 | 0.0 | -25.8 |
| 20 vs 30 | +25.8 | +5.3 | -20.4 |
| 30 vs 20 | +20.4 | -5.3 | -25.8 |

**핸디캡 효과:**
- 약한 기물로 무승부 = 레이팅 상승
- 약한 기물로 패배 = 손실 감소
- 강한 기물로 승리 = 획득 감소

## 주의사항

1. **AI 게임**: 현재 구현은 사람 vs 사람 게임만 지원합니다. AI 게임은 레이팅에 영향을 주지 않습니다.

2. **중복 저장 방지**: 게임 상태가 'playing'이 아니면 레이팅 업데이트를 건너뜁니다.

3. **에러 처리**: 레이팅 업데이트 실패 시 ratingChanges는 undefined로 전송됩니다.

4. **기존 saveGameResult**: 이전 `saveGameResult` 함수는 더 이상 사용되지 않습니다. 모든 게임 저장은 RatingService를 통해 처리됩니다.

## 테스트

핸디캡 시스템 테스트:
```bash
cd backend
npx tsx src/services/rating/Glicko2Handicap.test.ts
```

## 다음 단계

프롬프트 5-8에서 구현할 기능:
- 레이팅 티어 시스템
- 리더보드
- 레이팅 히스토리 그래프
- 매치메이킹 개선 (레이팅 기반)
