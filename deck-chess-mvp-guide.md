# 덱 빌딩 체스 PVP - MVP 개발 가이드

React + Node.js 기반 덱 빌딩 체스 게임 개발을 위한 완전한 프롬프트 모음입니다.

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [Phase 1: 프로젝트 초기 설정](#phase-1-프로젝트-초기-설정)
4. [Phase 2: 체스 엔진 구현](#phase-2-체스-엔진-구현)
5. [Phase 3: 프론트엔드 - 덱 빌더](#phase-3-프론트엔드---덱-빌더)
6. [Phase 4: WebSocket 멀티플레이](#phase-4-websocket-멀티플레이)
7. [Phase 5: 게임 플레이 UI](#phase-5-게임-플레이-ui)
8. [Phase 6: 백엔드 서비스](#phase-6-백엔드-서비스)
9. [Phase 7: 추가 UI 페이지](#phase-7-추가-ui-페이지)
10. [Phase 8: 최종 통합](#phase-8-최종-통합)
11. [Phase 9: 테스트 및 문서](#phase-9-테스트-및-문서)
12. [최종 체크리스트](#최종-체크리스트)

---

## 프로젝트 개요

### 게임 컨셉
- **덱 빌딩**: 30점 예산으로 기물 구성
- **전략적 배치**: 8x8 보드의 1-2행에 기물 배치
- **엔트로피 시스템**: 배치 위치에 따라 비용 가중치 적용
- **실시간 PVP**: WebSocket 기반 멀티플레이어

### 핵심 규칙
- **보드**: 8x8 표준 체스판
- **예산**: 30점
- **배치 영역**: 백(1-2행), 흑(7-8행)
- **킹**: 필수 배치 (0점, 1행 고정)
- **특수 규칙**: 처음 4수(양측 2수) 체크/캡처 금지

### 기물 점수
```
폰(p): 1점 (최대 8개)
나이트(n): 3점 (최대 2개)
비숍(b): 3점 (최대 2개)
룩(r): 5점 (최대 2개)
퀸(q): 9점 (최대 1개)
킹(k): 0점 (필수 1개)
```

### 엔트로피 가중치
```
1행 배치: 기본 점수 × 1.0
2행 배치: 기본 점수 × 1.3 (공격적)
```

---

## 기술 스택

### Frontend
- React 18 + TypeScript
- Vite (빌드 툴)
- Tailwind CSS (스타일링)
- Zustand (상태 관리)
- React Query (서버 상태)
- Socket.io-client (실시간 통신)
- Framer Motion (애니메이션)
- React Router (라우팅)

### Backend
- Node.js + Express + TypeScript
- Socket.io (WebSocket)
- PostgreSQL (데이터베이스)
- Prisma ORM (데이터베이스 ORM)
- Redis (매칭 큐, 선택사항)

### 배포
- Frontend: Vercel
- Backend: Railway / Render
- Database: Supabase

---

## Phase 1: 프로젝트 초기 설정

### Prompt 1-1: 프로젝트 구조 생성

```
덱 빌딩 체스 PVP 게임을 만들고 있습니다. 다음 요구사항에 맞는 모노레포 프로젝트 구조를 생성해주세요:

**기술 스택:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript + Socket.io
- Database: PostgreSQL + Prisma ORM
- Real-time: Socket.io

**프로젝트 구조:**
```
deck-chess/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── socket/
│   │   ├── engine/
│   │   ├── services/
│   │   ├── models/
│   │   └── server.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

각 디렉토리의 package.json과 기본 설정 파일들을 생성해주세요. 필요한 의존성 목록도 포함해주세요.
```

---

### Prompt 1-2: 데이터베이스 스키마 작성

```
덱 빌딩 체스 게임의 Prisma 스키마를 작성해주세요.

**요구사항:**

1. User 모델:
   - id (UUID)
   - username (고유값)
   - rating (Glicko 레이팅, 기본값 1500)
   - rd (Rating Deviation, 기본값 350)
   - volatility (기본값 0.06)
   - 관계: games[], decks[]

2. Deck 모델:
   - id (UUID)
   - name
   - userId (User 참조)
   - composition (JSON: {p: number, n: number, b: number, r: number, q: number})
   - totalCost (총 코스트)
   - wins, losses
   - 관계: gamesWhite[], gamesBlack[]

3. Game 모델:
   - id (UUID)
   - whiteId, blackId (User 참조)
   - whiteDeckId, blackDeckId (Deck 참조)
   - initialFen (배치 후 시작 FEN)
   - pgn (게임 기록)
   - result ("1-0", "0-1", "1/2-1/2")
   - createdAt, endedAt

schema.prisma 파일 전체를 작성해주세요.
```

---

## Phase 2: 체스 엔진 구현

### Prompt 2-1: 8x8 체스 엔진 기본 구조

```
8x8 체스 엔진을 TypeScript로 구현해주세요. 다음 기능이 필요합니다:

**파일: backend/src/engine/ChessEngine.ts**

**기능:**
1. 8x8 보드 표현 (2차원 배열)
2. 기본 기물 이동 규칙 (폰, 나이트, 비숍, 룩, 퀸, 킹)
3. 체크 감지
4. 체크메이트 감지
5. 합법적인 수 검증

**특수 규칙:**
- 처음 4수(양측 2수씩)는 체크와 캡처 금지
- 캐슬링, 앙파상은 MVP에서 제외

**인터페이스:**
```typescript
interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: PieceType;
}

type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type PieceColor = 'white' | 'black';
```

**필요한 메서드:**
- `isValidMove(move: Move): boolean`
- `makeMove(move: Move): void`
- `isCheck(color: PieceColor): boolean`
- `isCheckmate(color: PieceColor): boolean`
- `getLegalMoves(row: number, col: number): Move[]`
- `toFEN(): string`
- `fromFEN(fen: string): void`

전체 클래스를 구현해주세요.
```

---

### Prompt 2-2: FEN/PGN 변환기

```
체스 게임의 FEN(Forsyth-Edwards Notation)과 PGN(Portable Game Notation) 처리 유틸리티를 작성해주세요.

**파일: backend/src/engine/NotationConverter.ts**

**기능:**
1. FEN 생성 (보드 상태 → FEN 문자열)
2. FEN 파싱 (FEN 문자열 → 보드 상태)
3. PGN 기록 추가 (각 수를 PGN 형식으로 저장)
4. PGN 내보내기

**FEN 형식:**
```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1
[보드배치] [차례] [캐슬링] [앙파상] [50수규칙] [전체수]
```

**PGN 형식:**
```
1. e4 e5
2. Nf3 Nc6
3. Bb5 a6
```

전체 유틸리티 함수를 구현해주세요.
```

---

## Phase 3: 프론트엔드 - 덱 빌더

### Prompt 3-1: 덱 빌더 UI 컴포넌트

```
덱 빌더 페이지를 React + TypeScript + Tailwind CSS로 구현해주세요.

**파일: frontend/src/pages/DeckBuilder.tsx**

**요구사항:**

1. 기물 선택 팔레트:
   - 폰(1점) 최대 8개
   - 나이트(3점) 최대 2개
   - 비숍(3점) 최대 2개
   - 룩(5점) 최대 2개
   - 퀸(9점) 최대 1개
   - 킹은 자동 포함 (0점)

2. 실시간 예산 계산:
   - 남은 예산 표시 (30점 시작)
   - 초과시 경고 표시
   - 유효한 덱인지 검증

3. 덱 구성 표시:
   - 선택된 기물 목록
   - 총 코스트
   - 기물 개수

4. 저장/불러오기:
   - 덱 이름 입력
   - 저장 버튼
   - 저장된 덱 목록

**상태 관리는 Zustand 사용:**
```typescript
interface DeckStore {
  deck: {
    p: number;
    n: number;
    b: number;
    r: number;
    q: number;
  };
  budget: number;
  addPiece: (piece: PieceType) => void;
  removePiece: (piece: PieceType) => void;
  resetDeck: () => void;
  saveDeck: (name: string) => Promise<void>;
}
```

전체 컴포넌트와 Zustand 스토어를 구현해주세요. 반응형 디자인으로 만들어주세요.
```

---

### Prompt 3-2: 기물 배치 UI

```
게임 시작 전 기물 배치 페이지를 구현해주세요.

**파일: frontend/src/pages/PlacementPhase.tsx**

**요구사항:**

1. 8x8 체스보드 표시:
   - 백은 1-2행에만 배치 가능 (흑은 7-8행)
   - 킹은 1행 8개 위치 중 선택
   - 나머지 기물은 드래그 앤 드롭

2. 엔트로피 시스템 표시:
   - 1행: 기본 점수 (배경색 연한 회색)
   - 2행: 1.3배 점수 (배경색 연한 빨강)
   - 각 칸에 가중치 표시 (x1.0, x1.3)

3. 배치 검증:
   - 킹 필수 배치 확인
   - 예산 초과 확인
   - 중복 배치 방지

4. 실시간 피드백:
   - 현재 사용 코스트 표시
   - 남은 예산 표시
   - 배치 가능한 칸 하이라이트

5. 타이머:
   - 배치 제한 시간 (120초)
   - 타이머 표시

6. 준비 완료 버튼:
   - 유효한 배치일 때만 활성화
   - 클릭시 소켓으로 배치 전송

**드래그 앤 드롭 사용.**

컴포넌트 전체를 구현해주세요. react-dnd 또는 HTML5 Drag and Drop API 사용.
```

---

## Phase 4: WebSocket 멀티플레이

### Prompt 4-1: Socket.io 서버 구현

```
Socket.io 기반 실시간 게임 서버를 구현해주세요.

**파일: backend/src/socket/gameHandler.ts**

**이벤트 구조:**

클라이언트 → 서버:
- `matchmaking:join` (deckId: string)
- `matchmaking:cancel`
- `placement:ready` (placements: Placement[])
- `game:move` (move: Move)
- `game:resign`

서버 → 클라이언트:
- `match:found` (opponent: OpponentInfo, roomId: string)
- `placement:phase` (timeLimit: number)
- `placement:opponentReady`
- `game:start` (gameState: GameState)
- `game:update` (gameState: GameState)
- `game:end` (result: GameResult)

**기능:**

1. 매칭 큐 관리:
   - Redis 또는 Map 사용
   - 레이팅 ±200 이내 매칭
   - 30초 대기 후 범위 확대

2. 게임 룸 관리:
   - 각 게임별 고유 룸 생성
   - 룸별 게임 상태 관리
   - 연결 끊김 처리

3. 턴 관리:
   - 턴 타이머 (선택사항)
   - 수 검증
   - 게임 상태 동기화

**TypeScript 인터페이스:**
```typescript
interface GameState {
  roomId: string;
  white: PlayerInfo;
  black: PlayerInfo;
  board: string[][];
  currentTurn: 'white' | 'black';
  moveCount: number;
  pgn: string;
}

interface PlayerInfo {
  userId: string;
  username: string;
  rating: number;
}
```

전체 핸들러를 구현해주세요. ㅋㅋㅋㅋㅋㅋㅋㅋㅋ
```

---

### Prompt 4-2: Socket.io 클라이언트 훅

```
React에서 Socket.io를 사용하기 위한 커스텀 훅을 작성해주세요.

**파일: frontend/src/hooks/useSocket.ts**

**기능:**

1. 소켓 연결 관리:
   - 자동 연결/재연결
   - 연결 상태 추적
   - 에러 처리

2. 이벤트 리스너:
   - 타입 안전한 이벤트 emit/on
   - 자동 클린업
   - 재렌더링 최적화

3. 게임 상태 관리:
   - 실시간 게임 상태 동기화
   - 낙관적 업데이트

**사용 예시:**
```typescript
function GameRoom() {
  const { 
    socket, 
    isConnected, 
    gameState,
    sendMove,
    resign
  } = useSocket();
  
  // ...
}
```

**훅 인터페이스:**
```typescript
interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  gameState: GameState | null;
  
  // 매칭
  joinMatchmaking: (deckId: string) => void;
  cancelMatchmaking: () => void;
  
  // 배치
  submitPlacement: (placements: Placement[]) => void;
  
  // 게임
  sendMove: (move: Move) => void;
  resign: () => void;
}
```

전체 훅을 구현해주세요. Socket.io-client 사용.
```

---

## Phase 5: 게임 플레이 UI

### Prompt 5-1: 체스보드 컴포넌트

```
실시간 게임 플레이를 위한 체스보드 컴포넌트를 구현해주세요.

**파일: frontend/src/components/ChessBoard.tsx**

**요구사항:**

1. 보드 렌더링:
   - 8x8 그리드
   - 체스보드 패턴 (검은색/흰색 교차)
   - 좌표 표시 (a-h, 1-8)

2. 기물 표시:
   - 유니코드 체스 기물 심볼 또는 이미지
   - 백/흑 구분
   - 현재 차례 하이라이트

3. 상호작용:
   - 클릭으로 기물 선택
   - 이동 가능한 칸 하이라이트
   - 클릭으로 이동
   - 또는 드래그 앤 드롭

4. 시각 피드백:
   - 마지막 수 하이라이트
   - 체크 상태 표시 (킹 빨간색 배경)
   - 불법 수 시도시 애니메이션

5. 이동 기록:
   - PGN 형식으로 표시
   - 스크롤 가능한 목록
   - 클릭시 해당 포지션으로 이동 (선택)

**Props:**
```typescript
interface ChessBoardProps {
  gameState: GameState;
  isMyTurn: boolean;
  myColor: 'white' | 'black';
  onMove: (move: Move) => void;
}
```

react-chessboard 라이브러리를 사용하거나 직접 구현해주세요. Framer Motion으로 애니메이션 추가하면 좋습니다.
```

---

### Prompt 5-2: 게임 룸 페이지

```
전체 게임 룸 페이지를 구현해주세요.

**파일: frontend/src/pages/GameRoom.tsx**

**레이아웃:**
```
┌─────────────────────────────────────┐
│  상대 정보 (이름, 레이팅, 타이머)     │
├─────────────────────────────────────┤
│                                     │
│          8x8 체스보드               │
│                                     │
├─────────────────────────────────────┤
│  내 정보 (이름, 레이팅, 타이머)       │
├─────────────────────────────────────┤
│  이동 기록 | 채팅 (선택)            │
└─────────────────────────────────────┘
```

**기능:**

1. 플레이어 정보:
   - 프로필 (아바타, 이름, 레이팅)
   - 잡은 기물 표시
   - 남은 시간 (선택)

2. 체스보드:
   - ChessBoard 컴포넌트 사용
   - 내 색상에 따라 회전

3. 게임 컨트롤:
   - 항복 버튼
   - 무승부 제안 (선택)
   - 게임 나가기

4. 게임 종료 처리:
   - 결과 모달 (승/패/무승부)
   - 레이팅 변화 표시
   - 재경기 또는 나가기 버튼

5. 에러 처리:
   - 연결 끊김
   - 상대 연결 끊김
   - 불법 수

전체 페이지를 구현해주세요. 반응형 디자인으로.
```

---

## Phase 6: 백엔드 서비스

### Prompt 6-1: 덱 관리 서비스

```
덱 생성, 조회, 수정, 삭제를 위한 백엔드 서비스를 작성해주세요.

**파일: backend/src/services/deckService.ts**

**기능:**

1. `createDeck(userId: string, name: string, composition: DeckComposition): Promise<Deck>`
   - 덱 검증 (예산 30점 이내, 개수 제한)
   - 데이터베이스 저장

2. `getUserDecks(userId: string): Promise<Deck[]>`
   - 사용자의 모든 덱 조회
   - 승률 포함

3. `updateDeck(deckId: string, updates: Partial<Deck>): Promise<Deck>`
   - 덱 수정
   - 재검증

4. `deleteDeck(deckId: string): Promise<void>`
   - 덱 삭제

5. `validateDeck(composition: DeckComposition): ValidationResult`
   - 예산 확인
   - 개수 제한 확인
   - 킹 포함 확인

**타입:**
```typescript
interface DeckComposition {
  p: number; // 0-8
  n: number; // 0-2
  b: number; // 0-2
  r: number; // 0-2
  q: number; // 0-1
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  totalCost: number;
}
```

Prisma 사용. 전체 서비스를 구현해주세요.
```

---

### Prompt 6-2: 게임 관리 서비스

```
게임 생성, 진행, 종료를 위한 서비스를 작성해주세요.

**파일: backend/src/services/gameService.ts**

**기능:**

1. `createGame(whiteId, blackId, whiteDeckId, blackDeckId, initialFen): Promise<Game>`
   - 새 게임 생성
   - 데이터베이스 저장

2. `recordMove(gameId: string, move: Move, pgn: string): Promise<void>`
   - 수 기록
   - PGN 업데이트

3. `endGame(gameId: string, result: GameResult): Promise<void>`
   - 게임 종료 처리
   - 승패 기록
   - 레이팅 업데이트 (ratingService 호출)
   - 덱 승률 업데이트

4. `getGame(gameId: string): Promise<Game>`
   - 게임 조회

5. `getUserGames(userId: string, limit: number): Promise<Game[]>`
   - 사용자의 최근 게임 조회

**GameResult:**
```typescript
interface GameResult {
  winner: 'white' | 'black' | 'draw';
  reason: 'checkmate' | 'resignation' | 'timeout' | 'draw';
}
```

Prisma 사용. 전체 서비스를 구현해주세요.
```

---

### Prompt 6-3: Glicko 레이팅 시스템

```
Glicko 레이팅 시스템을 구현해주세요.

**파일: backend/src/services/ratingService.ts**

**Glicko 시스템:**
- Rating (r): 기본 1500
- Rating Deviation (rd): 기본 350
- Volatility (σ): 기본 0.06

**기능:**

1. `updateRating(winnerId, loserId, isDraw): Promise<void>`
   - 양 플레이어의 레이팅 계산
   - 데이터베이스 업데이트

2. Glicko-2 알고리즘:
   - Step 1: 스케일 변환
   - Step 2: 새 RD 계산
   - Step 3: 새 레이팅 계산
   - Step 4: 새 volatility 계산

**참고 공식:**
```
g(φ) = 1 / √(1 + 3φ²/π²)
E(μ, μⱼ, φⱼ) = 1 / (1 + exp(-g(φⱼ)(μ - μⱼ)))
```

**라이브러리 사용 가능:**
- glicko2 npm 패키지

전체 서비스를 구현해주세요. 직접 구현하거나 라이브러리 사용.
```

---

## Phase 7: 추가 UI 페이지

### Prompt 7-1: 메인 페이지

```
메인 랜딩 페이지를 구현해주세요.

**파일: frontend/src/pages/Home.tsx**

**섹션:**

1. 히어로 섹션:
   - 게임 제목
   - 캐치프레이즈
   - "게임 시작" 버튼
   - 배경 애니메이션 (선택)

2. 사용자 정보 (로그인시):
   - 프로필
   - 레이팅
   - 승/패 기록

3. 빠른 액세스:
   - 덱 빌더로 이동
   - 매칭 시작
   - 게임 기록 보기

4. 최근 게임:
   - 최근 3개 게임 표시
   - 결과 (승/패)
   - 사용한 덱

**디자인:**
- Tailwind CSS 사용
- 반응형 (모바일/데스크톱)
- 다크 모드 지원 (선택)

전체 컴포넌트를 구현해주세요.
```

---

### Prompt 7-2: 매칭 대기 페이지

```
매칭 대기 중 화면을 구현해주세요.

**파일: frontend/src/pages/Matchmaking.tsx**

**요소:**

1. 덱 선택:
   - 저장된 덱 목록
   - 덱 상세 정보 (기물 구성, 승률)
   - 선택된 덱 하이라이트

2. 매칭 대기:
   - 로딩 애니메이션
   - "매칭 중..." 메시지
   - 경과 시간
   - 취소 버튼

3. 매칭 성공:
   - 상대 정보 표시
   - "게임 준비" 애니메이션
   - 자동으로 배치 페이지로 이동

4. 에러 처리:
   - 덱 선택 안함
   - 매칭 타임아웃
   - 서버 오류

**애니메이션:**
- Framer Motion 사용
- 체스 기물 회전 애니메이션
- 페이드 인/아웃

전체 컴포넌트를 구현해주세요.
```

---

## Phase 8: 최종 통합

### Prompt 8-1: 라우팅 및 네비게이션

```
React Router를 사용한 라우팅과 네비게이션을 설정해주세요.

**파일: frontend/src/App.tsx**

**라우트:**
- `/` - 메인 페이지
- `/deck-builder` - 덱 빌더
- `/matchmaking` - 매칭
- `/placement/:gameId` - 기물 배치
- `/game/:gameId` - 게임 플레이
- `/profile` - 프로필 (선택)
- `/history` - 게임 기록 (선택)

**네비게이션 바:**
- 로고
- 메뉴 (홈, 덱 빌더, 프로필)
- 레이팅 표시
- 로그아웃 (선택)

**Protected Routes:**
- 인증 필요한 페이지 처리
- 리다이렉트

**전역 상태:**
- 인증 상태 (선택, 간단히 localStorage 사용)
- 사용자 정보

전체 라우팅 설정과 App 컴포넌트를 구현해주세요.
```

---

### Prompt 8-2: Express 서버 메인

```
Express 서버의 메인 엔트리 포인트를 작성해주세요.

**파일: backend/src/server.ts**

**설정:**

1. Express 앱 설정:
   - CORS
   - JSON body parser
   - 에러 핸들링

2. Socket.io 통합:
   - HTTP 서버와 연결
   - CORS 설정

3. 라우트:
   - `/api/decks` - 덱 CRUD
   - `/api/games` - 게임 조회
   - `/api/users` - 사용자 정보 (선택)

4. 데이터베이스 연결:
   - Prisma 클라이언트 초기화

5. 서버 시작:
   - 포트: 3001
   - 환경변수 처리

**환경변수 (.env):**
```
DATABASE_URL="postgresql://..."
PORT=3001
NODE_ENV=development
```

**미들웨어:**
- 인증 (선택, 간단히 구현)
- 에러 핸들링
- 로깅

전체 서버 코드를 구현해주세요.ㅎㅎ
```

---

## Phase 9: 테스트 및 문서

### Prompt 9-1: README 작성

```
프로젝트 README.md를 작성해주세요.

**포함할 내용:**

1. 프로젝트 소개:
   - 게임 설명
   - 주요 기능

2. 기술 스택:
   - Frontend
   - Backend
   - Database

3. 설치 및 실행:
   ```bash
   # 데이터베이스 설정
   cd backend
   npx prisma migrate dev
   
   # 백엔드 실행
   npm install
   npm run dev
   
   # 프론트엔드 실행 (새 터미널)
   cd frontend
   npm install
   npm run dev
   ```

4. 게임 규칙:
   - 덱 빌딩 규칙
   - 배치 규칙
   - 엔트로피 시스템
   - 특수 규칙

5. API 문서 (간단히):
   - 주요 엔드포인트
   - Socket.io 이벤트

6. 개발 로드맵:
   - MVP 완료 항목
   - 향후 계획

7. 라이센스 (선택)

마크다운 형식으로 작성해주세요.
```

---

### Prompt 9-2: 배포 스크립트

```
프로덕션 배포를 위한 설정을 작성해주세요.

**1. Frontend 빌드 (Vercel):**

파일: `frontend/vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "framework": "vite"
}
```

**2. Backend 배포 (Railway/Render):**

파일: `backend/Procfile`
```
web: npm run start
```

파일: `backend/package.json` - scripts 추가
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev src/server.ts"
  }
}
```

**3. 환경변수 설정:**
- DATABASE_URL
- FRONTEND_URL (CORS용)
- PORT

**4. Docker 설정 (선택):**

파일: `Dockerfile`
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

모든 배포 관련 파일을 작성해주세요.
```

---

## 최종 체크리스트

### MVP 완성 확인

```
다음 기능들이 모두 작동하는지 확인해주세요:

□ 덱 빌더
  □ 기물 선택 (예산 30점 제한)
  □ 덱 저장/불러오기
  □ 덱 검증

□ 매칭
  □ 덱 선택
  □ 매칭 큐 대기
  □ 상대 매칭

□ 기물 배치
  □ 8x8 보드에 배치
  □ 엔트로피 가중치 반영
  □ 킹 위치 선택
  □ 배치 검증

□ 게임 플레이
  □ 체스 룰 준수
  □ 처음 2수 체크/캡처 금지
  □ 실시간 동기화
  □ 체크메이트 감지

□ 게임 종료
  □ 결과 저장
  □ 레이팅 업데이트
  □ 승률 업데이트

□ 에러 처리
  □ 연결 끊김
  □ 불법 수
  □ 타임아웃
```

---

## 개발 일정

### 1주일 MVP 개발 계획

**Day 1-2: 기반 설정 및 체스 엔진**
- Phase 1: 프로젝트 구조 생성
- Phase 2: 체스 엔진 구현
- 테스트: 기본 체스 로직 검증

**Day 3: 덱 빌더**
- Phase 3: 덱 빌더 UI
- 테스트: 덱 생성/저장

**Day 4: 기물 배치**
- Phase 3-2: 배치 UI
- 엔트로피 시스템 구현
- 테스트: 배치 검증

**Day 5-6: 멀티플레이**
- Phase 4: WebSocket 구현
- Phase 5: 게임 플레이 UI
- Phase 6: 백엔드 서비스
- 테스트: 전체 게임 플로우

**Day 7: 통합 및 배포**
- Phase 7-8: 추가 UI 및 통합
- Phase 9: 문서화
- 배포 및 최종 테스트

---

## 확장 로드맵 (MVP 이후)

### Week 2-3: 밸런싱 및 분석
- Google Colab 시뮬레이션
- 기물 점수 조정
- 엔트로피 가중치 최적화
- 실전 데이터 수집

### Week 4-6: 고급 기능
- AI 상대 (Stockfish 연동)
- 게임 분석 기능
- 배터리 시스템
- 킹 변형 (고정형/활동형)
- 토너먼트 모드

### Week 7-8: 커뮤니티 기능
- 리더보드
- 덱 공유/추천
- 리플레이 시스템
- 도전과제/업적
- 소셜 기능

---

## 💡 개발 팁

### 효율적인 개발을 위한 조언

1. **단계별 진행**: 각 Phase를 순서대로 완성한 후 다음으로 넘어가세요.

2. **빠른 테스트**: 각 기능 구현 후 즉시 테스트하세요. 버그는 빨리 찾을수록 수정이 쉽습니다.

3. **Git 활용**: 각 Phase 완료 후 커밋하세요. 문제 발생시 롤백이 쉬워집니다.

4. **MVP 집중**: 처음에는 핵심 기능만 구현하세요. 완벽함보다 작동하는 제품이 중요합니다.

5. **사용자 피드백**: 실제 유저 테스트를 통해 밸런스를 조정하세요. 시뮬레이션보다 실전 데이터가 정확합니다.

### 자주 발생하는 문제

**WebSocket 연결 문제**
- CORS 설정 확인
- 클라이언트/서버 URL 일치 확인
- 재연결 로직 구현

**체스 로직 버그**
- 단위 테스트 작성
- 알려진 체스 포지션으로 검증
- FEN 문자열 파싱 주의

**레이팅 시스템**
- Glicko-2 공식 정확히 구현
- 테스트 데이터로 검증
- RD 값 적절히 설정

---

## 📚 참고 자료

### 체스 관련
- [Chess Programming Wiki](https://www.chessprogramming.org/)
- [FEN Notation](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation)
- [PGN Standard](https://en.wikipedia.org/wiki/Portable_Game_Notation)

### 기술 문서
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Query Documentation](https://tanstack.com/query/latest)

### 레이팅 시스템
- [Glicko-2 Rating System](http://www.glicko.net/glicko/glicko2.pdf)
- [Glicko2 NPM Package](https://www.npmjs.com/package/glicko2)

---

## 📧 문의 및 기여

이 가이드에 대한 문의사항이나 개선 제안이 있으시면 언제든 연락주세요!

**Good luck with your deck-building chess game! 🎮♟️**

---

_Last Updated: 2026-01-23_
_Version: 1.0.0 - MVP Development Guide_
