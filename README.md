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
- PostgreSQL 14 이상
- npm 또는 yarn

### 설치

1. **저장소 클론 및 의존성 설치**

```bash
# 루트 디렉토리에서
npm install

# Frontend 및 Backend 의존성 자동 설치 (workspaces)
```

2. **환경 변수 설정**

```bash
# Backend 환경 변수 설정
cd backend
cp .env.example .env

# .env 파일을 열어 데이터베이스 연결 정보 수정
# DATABASE_URL="postgresql://user:password@localhost:5432/deckchess"
```

3. **데이터베이스 설정**

```bash
# Backend 디렉토리에서
npm run prisma:generate  # Prisma 클라이언트 생성
npm run prisma:migrate   # 데이터베이스 마이그레이션
```

### 개발 서버 실행

#### 모든 서비스 동시 실행 (권장)

```bash
# 루트 디렉토리에서
npm run dev
```

이 명령은 Frontend와 Backend를 동시에 실행합니다:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

#### 개별 실행

```bash
# Frontend만 실행
npm run dev:frontend

# Backend만 실행
npm run dev:backend
```

### 프로덕션 빌드

```bash
# 모든 프로젝트 빌드
npm run build

# 개별 빌드
npm run build:frontend
npm run build:backend
```

## 🎯 주요 기능

- **덱 빌딩 시스템**: 다양한 체스 기물 카드로 나만의 덱 구성
- **실시간 PVP**: Socket.io를 통한 실시간 대전
- **전략적 플레이**: 체스의 전술과 카드 게임의 전략이 결합
- **매치메이킹**: 자동 상대 매칭 시스템

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
