# Glicko-2 마이그레이션 가이드

## 1. 변경 사항 요약

### User 모델
- `rating`: Int → **Float** (기본값 1500.0 유지)
- `rd` → `rating_deviation`: Float (기본값 350.0)
- `volatility`: Float (기본값 0.06, 기존 유지)
- `last_game_at`: DateTime? (새로 추가, RD 증가 계산용)

### Game 모델
- `rating_changes`: Json? (새로 추가, 레이팅 변화 기록)

### GameHistory 모델 (game_history 테이블)
- `rating_change`: Int → **Float**
- `piece_score`: Int? (새로 추가, 사용한 기물 점수 1-30)

## 2. 마이그레이션 실행 방법

### Option A: Prisma Migrate 사용 (권장)

```bash
# 1. 마이그레이션 생성
cd backend
npx prisma migrate dev --name add_glicko2_fields

# 2. Prisma Client 재생성
npx prisma generate
```

### Option B: 수동 SQL 실행

기존 데이터가 있는 프로덕션 환경에서는 수동 SQL 실행을 권장합니다:

```bash
# PostgreSQL 접속
psql -U your_username -d your_database

# SQL 파일 실행
\i backend/prisma/migrations/glicko2_migration.sql
```

## 3. 데이터 마이그레이션 전략

### 기존 사용자 데이터 처리

현재 스키마에서 이미 다음 기본값이 설정되어 있습니다:
- rating: 1500 (Int → Float 변환, 값 유지)
- rd (rating_deviation): 350.0
- volatility: 0.06

**추가 작업이 필요한 경우:**

```sql
-- 기존 사용자의 last_game_at 설정 (최근 게임 시간으로)
UPDATE "user" u
SET last_game_at = (
  SELECT MAX(g.played_at)
  FROM game g
  WHERE g.white_player_id = u.id OR g.black_player_id = u.id
)
WHERE EXISTS (
  SELECT 1 FROM game g
  WHERE g.white_player_id = u.id OR g.black_player_id = u.id
);

-- 게임 기록이 없는 사용자는 NULL 유지 (초기 RD 350 적용)
```

## 4. rating_changes JSON 구조

게임이 끝날 때 저장될 JSON 형식:

```json
{
  "white": {
    "playerId": 1,
    "before": {
      "rating": 1500.0,
      "ratingDeviation": 350.0,
      "volatility": 0.06
    },
    "after": {
      "rating": 1516.5,
      "ratingDeviation": 290.2,
      "volatility": 0.059
    },
    "change": 16.5
  },
  "black": {
    "playerId": 2,
    "before": {
      "rating": 1500.0,
      "ratingDeviation": 350.0,
      "volatility": 0.06
    },
    "after": {
      "rating": 1483.5,
      "ratingDeviation": 290.2,
      "volatility": 0.059
    },
    "change": -16.5
  }
}
```

## 5. 롤백 계획

마이그레이션을 되돌려야 할 경우:

```sql
-- rating을 Int로 되돌리기 (소수점 버림)
ALTER TABLE "user" 
  ALTER COLUMN "rating" TYPE INTEGER USING rating::integer;

-- rating_deviation을 rd로 되돌리기
ALTER TABLE "user" 
  RENAME COLUMN "rating_deviation" TO "rd";

-- 추가된 컬럼 제거
ALTER TABLE "user" DROP COLUMN IF EXISTS "last_game_at";
ALTER TABLE "game" DROP COLUMN IF EXISTS "rating_changes";
ALTER TABLE "game_history" DROP COLUMN IF EXISTS "piece_score";

-- rating_change를 Int로 되돌리기
ALTER TABLE "game_history"
  ALTER COLUMN "rating_change" TYPE INTEGER USING rating_change::integer;
```

## 6. 검증 쿼리

마이그레이션 후 다음 쿼리로 확인:

```sql
-- User 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user'
AND column_name IN ('rating', 'rating_deviation', 'volatility', 'last_game_at');

-- Game 테이블 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'game' AND column_name = 'rating_changes';

-- GameHistory 테이블 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'game_history'
AND column_name IN ('rating_change', 'piece_score');
```

## 7. 주의사항

1. **프로덕션 마이그레이션 전 백업 필수**
   ```bash
   pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql
   ```

2. **타입 변경 시 주의점**
   - Int → Float 변환은 안전하지만, 역방향(Float → Int)은 데이터 손실 가능
   - 기존 rating_change 값들이 Float로 정확히 변환되는지 확인

3. **인덱스 재구성**
   - rating 컬럼의 타입이 변경되므로 인덱스 자동 재구성됨
   - 성능 모니터링 권장

4. **Application Code 업데이트**
   - Prisma Client 재생성 후 TypeScript 타입이 변경됨
   - rating이 number (Int)에서 number (Float)로 변경되나 TypeScript에서는 동일

## 8. 다음 단계

스키마 마이그레이션 완료 후:
- 프롬프트 2: Glicko-2 계산 엔진 구현
- 프롬프트 3: Rating 업데이트 서비스
- 프롬프트 4: 게임 종료 시 레이팅 적용
- ... (나머지 프롬프트)
