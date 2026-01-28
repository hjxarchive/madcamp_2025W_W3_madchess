# Glicko-2 Rating System - 마이그레이션 및 테스트 가이드

## 1. 데이터 마이그레이션

### 기존 ELO → Glicko-2 변환

```bash
# 1. 마이그레이션 SQL 실행
cd backend
psql -U your_username -d your_database -f prisma/migrations/convert_elo_to_glicko2.sql

# 또는 Prisma를 통한 실행
npx prisma db execute --file prisma/migrations/convert_elo_to_glicko2.sql
```

### 변환 공식
- **Rating**: `new_rating = 1500 + (old_elo - 1200) * 1.5`
- **RD**: 게임 수에 따라 50~350
  - 50게임 이상: RD 50
  - 20-50게임: RD 80
  - 10-20게임: RD 120
  - 10게임 미만: RD 350 (신규)
- **Volatility**: 0.06 (표준값)

## 2. 테스트 실행

### 모든 테스트 실행

```bash
cd backend

# Jest 설치 (아직 안 했다면)
npm install --save-dev jest ts-jest @types/jest

# Jest 설정 파일 생성
npx ts-jest config:init

# 모든 테스트 실행
npm test

# 특정 테스트만 실행
npm test Glicko2.test
npm test Glicko2Handicap.test
npm test RatingService.test

# 커버리지 확인
npm test -- --coverage
```

### 개별 테스트 실행 (tsx 사용)

```bash
# Glicko-2 순수 계산 테스트
npx tsx --test src/services/rating/Glicko2.test.ts

# 핸디캡 시스템 테스트
npx tsx --test src/services/rating/Glicko2Handicap.test.ts

# 통합 테스트
npx tsx --test src/services/RatingService.test.ts
```

## 3. 테스트 커버리지

### Glicko2.test.ts
- ✅ 동일 레이팅 플레이어 대결 (1500 vs 1500)
- ✅ 레이팅 차이 500점 대결 (Upset 시나리오)
- ✅ RD 변화 추적
- ✅ 비활동 기간 RD 증가 (30일, 180일, 365일)
- ✅ 10연승 시나리오
- ✅ 5승 5패 (원점 복귀)
- ✅ 극단적 케이스 (신규 vs 베테랑)

### Glicko2Handicap.test.ts
- ✅ 동일 기물 점수 (30:30)
- ✅ 기물 점수 10점 차이 (20:30, 30:20)
- ✅ 최대 핸디캡 (0:30, 30:0)
- ✅ 핸디캡 모디파이어 계산
- ✅ 예상 레이팅 변화
- ✅ 실전 시나리오 (약자 승리, 강자 패배)
- ✅ 경계값 테스트

### RatingService.test.ts
- ✅ 30일/180일/365일 비활동 RD 증가
- ✅ 10연승 레이팅 상승 추적
- ✅ 10연승 후 1패 영향
- ✅ 핸디캡 연승 시나리오
- ✅ 레이팅 차이 큰 매치 (1200 vs 1800)
- ✅ 극단적 RD 시나리오 (RD 350 vs RD 40)
- ✅ 무승부 연속
- ✅ 예상 레이팅 변화 계산

## 4. 예상 결과

### 동일 레이팅 대결 (1500 vs 1500)
| 기물 점수 | 승리 | 무승부 | 패배 |
|----------|------|-------|------|
| 30:30    | +25  | 0     | -25  |
| 20:30    | +28  | +3    | -22  |
| 30:20    | +22  | -3    | -28  |

### 레이팅 차이 대결 (1200 vs 1800)
| 결과 | 1200 변화 | 1800 변화 |
|------|----------|----------|
| 1200 승 | +70~80 | -70~80 |
| 무승부 | +30~40 | -30~40 |
| 1800 승 | -10~15 | +10~15 |

### RD 변화
- **게임 후**: RD 감소 (불확실성 감소)
- **30일 비활동**: RD +10~20
- **180일 비활동**: RD +150~200
- **365일 비활동**: RD → 최대값 (350)

### 10연승 시나리오
- **초기**: 1500 (RD 200)
- **10연승 후**: 1700+ (RD <100)
- **레이팅 상승**: 200점 이상
- **RD 감소**: 100점 이상

## 5. 검증 방법

### 1단계: 기본 계산 검증
```typescript
const player = { rating: 1500, rd: 200, volatility: 0.06 };
const match = { opponentRating: 1500, opponentRd: 200, score: 1.0 };
const result = calculateRatingChange(player, [match]);

// 예상: newRating ≈ 1525
```

### 2단계: 핸디캡 검증
```typescript
const result = calculateHandicapRatingChange(player, match, 20, 30);
// 예상: newRating > 1525 (보너스)
```

### 3단계: 연승 검증
10연승 후:
- Rating: 1500 → 1700+
- RD: 200 → <100

### 4단계: 비활동 검증
30일 비활동:
- RD: 80 → 90~100

## 6. 롤백 절차

문제 발생 시:
```sql
-- 백업에서 복원
UPDATE "user" SET 
  rating = 1200 + (rating - 1500) / 1.5,
  rd = 350.0,
  volatility = 0.06,
  last_game_at = NULL;
```

## 7. 모니터링

마이그레이션 후 확인사항:
```sql
-- 레이팅 분포 확인
SELECT 
  FLOOR(rating / 100) * 100 as rating_range,
  COUNT(*) as count
FROM "user"
GROUP BY rating_range
ORDER BY rating_range;

-- RD 분포 확인
SELECT 
  CASE 
    WHEN rd < 100 THEN '<100'
    WHEN rd < 200 THEN '100-200'
    ELSE '>200'
  END as rd_range,
  COUNT(*) as count
FROM "user"
GROUP BY rd_range;

-- 최고/최저 레이팅
SELECT username, rating, rd 
FROM "user" 
ORDER BY rating DESC 
LIMIT 10;
```

## 8. 문제 해결

### Jest 설정 (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
```

### TypeScript 컴파일 확인
```bash
npx tsc --noEmit
```

### 테스트 통과 확인
```bash
npm test -- --verbose
```

## 9. 성공 기준

- ✅ 모든 테스트 통과 (Glicko2, Handicap, RatingService)
- ✅ 마이그레이션 오류 없음
- ✅ 레이팅 분포 정상 (1200~2000 범위)
- ✅ RD 값 정상 (30~350 범위)
- ✅ 기존 게임 기록 보존

## 10. 다음 단계

1. 프로덕션 배포 전 스테이징 테스트
2. 레이팅 히스토리 그래프 구현
3. 매치메이킹 알고리즘 개선 (레이팅 기반)
4. 리더보드 캐싱 (Redis)
5. A/B 테스트 (핸디캡 가중치 조정)
