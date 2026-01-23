# Deck Chess - PVP Game

덱 빌딩 체스 PVP 게임입니다. 전략적인 덱 구성과 체스의 전술적 플레이를 결합한 실시간 멀티플레이어 게임입니다.

## 🎮 기술 스택

### Frontend
- **React 18** - UI 프레임워크
- **TypeScript** - 타입 안정성
- **Vite** - 빠른 개발 환경
- **Tailwind CSS** - 유틸리티 스타일링
- **Zustand** - 상태 관리
- **Socket.io Client** - 실시간 통신

### Backend
- **Node.js** - 런타임
- **Express** - 웹 프레임워크
- **TypeScript** - 타입 안정성
- **Socket.io** - 실시간 통신
- **PostgreSQL** - 데이터베이스
- **Prisma ORM** - 데이터베이스 ORM

## 📁 프로젝트 구조

```
deck-chess/
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/   # 재사용 가능한 컴포넌트
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── stores/       # Zustand 스토어
│   │   ├── hooks/        # 커스텀 훅
│   │   ├── services/     # API 및 Socket 서비스
│   │   ├── types/        # TypeScript 타입 정의
│   │   └── utils/        # 유틸리티 함수
│   └── package.json
│
├── backend/              # Node.js 백엔드
│   ├── src/
│   │   ├── socket/      # Socket.io 핸들러
│   │   ├── engine/      # 게임 엔진 로직
│   │   ├── services/    # 비즈니스 로직 서비스
│   │   ├── models/      # 데이터 모델
│   │   └── server.ts    # 서버 진입점
│   ├── prisma/
│   │   └── schema.prisma # 데이터베이스 스키마
│   └── package.json
│
└── README.md
```

## 🚀 시작하기

### 필수 요구사항

- Node.js 18 이상
- PostgreSQL 14 이상 (선택사항)
- npm 또는 yarn

### 설치

1. **Frontend 의존성 설치**

```bash
cd frontend
npm install
```

2. **Backend 의존성 설치**

```bash
cd backend
npm install
```

3. **환경 변수 설정 (선택사항)**

```bash
# Backend 환경 변수 설정
cd backend
cp .env.example .env

# .env 파일을 열어 데이터베이스 연결 정보 수정
# DATABASE_URL="postgresql://user:password@localhost:5432/deckchess"
```

### 개발 서버 실행

#### Frontend 실행

```bash
cd frontend
npm run dev
```

Frontend 서버가 http://localhost:5173 에서 실행됩니다.

#### Backend 실행 (선택사항)

```bash
cd backend
npm run dev
```

Backend 서버가 http://localhost:3001 에서 실행됩니다.

### 체스보드 UI 테스트

1. Frontend 개발 서버를 실행합니다
2. 브라우저에서 http://localhost:5173 를 엽니다
3. `/game/test` 경로로 이동하면 체스보드 UI를 확인할 수 있습니다

## 🎯 구현된 기능

### ✅ 완료된 기능
- **체스보드 UI**: 8x8 체스보드 렌더링
- **기물 표시**: 유니코드 체스 기물 심볼
- **기물 선택 및 이동**: 클릭하여 기물 선택 및 이동
- **합법적인 수 표시**: 이동 가능한 칸 하이라이트
- **플레이어 정보**: 플레이어 이름, 레이팅, 잡은 기물 표시
- **턴 관리**: 현재 차례 표시 및 턴 변경
- **보드 회전**: 플레이어 색상에 따라 보드 회전
- **반응형 디자인**: Tailwind CSS 기반 반응형 UI

### 🚧 개발 예정
- **덱 빌딩 시스템**: 30점 예산으로 기물 구성
- **기물 배치 페이지**: 게임 시작 전 기물 배치
- **엔트로피 시스템**: 배치 위치에 따른 비용 가중치
- **실시간 PVP**: Socket.io 기반 멀티플레이어
- **매치메이킹**: 레이팅 기반 자동 매칭
- **체스 엔진**: 완전한 체스 룰 검증
- **Glicko 레이팅 시스템**: 레이팅 업데이트

## 🎮 게임 규칙 (예정)

### 덱 빌딩
- **예산**: 30점
- **배치 영역**: 백(1-2행), 흑(7-8행)
- **킹**: 필수 배치 (0점, 1행 고정)

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

### 특수 규칙
- 처음 4수(양측 2수) 체크/캡처 금지

## 🗄️ 데이터베이스 스키마

주요 모델:
- **User**: 사용자 정보
- **Deck**: 덱 정보
- **Card**: 카드 정보
- **Match**: 게임 매치 정보
- **GamePlayer**: 게임 참가자 정보

자세한 스키마는 [backend/prisma/schema.prisma](backend/prisma/schema.prisma)를 참조하세요.

## 🛠️ 개발 도구

```bash
# Prisma Studio (데이터베이스 GUI)
cd backend
npm run prisma:studio
```

## 📝 라이센스

MIT

## 👥 기여

기여는 언제나 환영합니다! Pull Request를 보내주세요.
