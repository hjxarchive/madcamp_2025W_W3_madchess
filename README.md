
# ♟️ MadChess

**MadChess**는 플레이어가 자유롭게 기물을 배치하고 대전할 수 있는 커스텀 체스 게임입니다. 실시간 멀티플레이어 대전, 대국 관전, Glicko 레이팅 시스템, 대국 기록 관리, 포지션 분석을 지원합니다.

![MadChess](https://img.shields.io/badge/MadChess-Custom%20Chess-D4FF00?style=for-the-badge&logo=chess&logoColor=black)

---
## 🎮 플레이
<img width="500" alt="madcamp cloud_" src="https://github.com/user-attachments/assets/9cc6c273-2ceb-4bf6-bd8e-d6cc7d00312f" />


🔗 Play Live: [https://madcamp.cloud](https://madcamp.cloud/)


## 📋 목차

- [핵심 기능](#-핵심-기능)
- [기술 스택](#-기술-스택)
- [DB 스키마](#-db-스키마)
- [API 요약](#-api-요약)
- [배포 구성](#-배포-구성)
- [로컬 개발 환경 설정](#-로컬-개발-환경-설정)

---

## 🎯 핵심 기능

### 1. 커스텀 기물 배치 시스템
- **자유 배치**: 표준 체스와 달리 플레이어가 원하는 위치에 기물 배치 가능
- **덱 저장/불러오기**: 자주 사용하는 배치를 저장하고 재사용
- **배치 규칙**: 각 기물별 최대 개수 제한 (킹 1개, 퀸 1개, 룩 2개, 비숍 2개, 나이트 2개, 폰 8개)


### 2. 실시간 멀티플레이어 대전
- **실시간 통신**: Socket.IO 기반 양방향 실시간 게임
- **방 생성/참가**: 원하는 색상 선택 후 방 생성 또는 기존 방 참가
- **프리무브**: 상대 턴에 미리 수를 입력해두는 기능
- **관전 모드**: 진행 중인 게임 관전 지원

### 3. 게임 진행
- **합법수 검증**: 서버에서 모든 수의 합법성 검증
- **체크/체크메이트 감지**: 실시간 체크 상태 표시 및 게임 종료 판정
- **특수 규칙 지원**: 캐슬링, 프로모션
- **타이머**: 불렛, 블리츠, 래피드 총 9개 시간 모드 지원
- **Glicko2 레이팅**: 기존 ELO 레이팅을 개선하여 보다 합리적인 레이팅 변동을 제공

### 4. 대국 기록 및 히스토리
- **PGN 기록**: 모든 수를 PGN 형식으로 기록
- **히스토리 네비게이션**: 이전/다음 수 탐색 기능
- **최근 수 하이라이트**: 마지막으로 둔 수 시각적 표시
- **게임 리플레이**: 저장된 대국 다시 보기
- **변형 체스 분석**: 변형 체스를 지원하는 Fairy-Stockfish를 활용해 포지션 분석

### 5. 게임 종료 조건
- **체크메이트**: 킹이 탈출 불가능한 체크 상태
- **스테일메이트**: 합법수 없음 (무승부)
- **기권**: 플레이어가 기권 선언
- **합의 무승부**: 양 플레이어 합의

## Glicko2 레이팅 시스템

### 개요

플레이어 실력을 측정하는 레이팅 시스템으로, Elo 시스템을 개선하여 **레이팅 신뢰도(RD)** 와 **변동성**을 추가했습니다.

### 핵심 지표

| 지표 | 기본값 | 설명 |
|------|--------|------|
| **Rating** | 1500 | 플레이어 실력 수치 |
| **RD** | 350 | 레이팅 신뢰도 (낮을수록 정확) |
| **Volatility** | 0.06 | 성적 일관성 (낮을수록 안정) |

### 기물 점수 핸디캡

30점 내 자유 기물 배치 시스템에서, 적은 기물 사용 시 레이팅 어드밴티지 제공:

| 기물 (나 vs 상대) | 승리 | 패배 | 무승부 |
|------------------|------|------|--------|
| 30 vs 30 | +25.8 | -25.8 | 0.0 |
| 20 vs 30 | +25.8 | **-20.6** | **+5.2** |
| 30 vs 20 | **+20.6** | -25.8 | **-5.2** |

- ✅ 적은 기물로 패배 → 완충 효과
- ✅ 적은 기물로 무승부 → 레이팅 상승
- ⚠️ 많은 기물로 승리 → 보상 감소

---

## 🛠 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 18.x | UI 라이브러리 |
| TypeScript | 5.x | 정적 타입 |
| Vite | 5.x | 빌드 도구 |
| Tailwind CSS | 3.x | 스타일링 |
| Zustand | 4.x | 상태 관리 |
| Socket.IO Client | 4.x | 실시간 통신 |
| React Router | 6.x | 라우팅 |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Node.js | 18.x+ | 런타임 |
| Express | 4.x | HTTP 서버 |
| TypeScript | 5.x | 정적 타입 |
| Socket.IO | 4.x | 실시간 통신 |
| Prisma | 5.x | ORM |
| PostgreSQL | 15.x | 데이터베이스 |
| bcrypt | 5.x | 비밀번호 해싱 |

### DevOps & Deployment
| 기술 | 용도 |
|------|------|
| Nginx | 리버스 프록시, 정적 파일 서빙 |
| PM2 | Node.js 프로세스 매니저 |
| Let's Encrypt | SSL 인증서 |
| Ubuntu | 서버 OS |

---

## 💾 DB 스키마

<img width="1070" height="1000" alt="madchess-DB" src="https://github.com/user-attachments/assets/77cd1c01-023f-4a6d-856a-13e21f00995b" />

---

## 📡 API 요약

### REST API

#### 인증 (Auth)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/auth/me` | 현재 사용자 정보 |

#### 덱 관리 (Deck)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/decks` | 내 덱 목록 조회 |
| POST | `/api/decks` | 새 덱 저장 |
| PUT | `/api/decks/:id` | 덱 수정 |
| DELETE | `/api/decks/:id` | 덱 삭제 |

#### 매치 (Match)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/matches` | 내 대국 목록 |
| GET | `/api/matches/:id` | 대국 상세 정보 |
| GET | `/api/matches/live` | 진행 중인 대국 목록 |

#### 리더보드 (Leaderboard)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/leaderboard` | 상위 플레이어 순위 |

---

### Socket.IO Events

#### 클라이언트 → 서버

| Event | Payload | 설명 |
|-------|---------|------|
| `create-room` | `{ color, userId }` | 방 생성 |
| `join-room` | `{ matchId, userId }` | 방 참가 |
| `placement:ready` | `{ matchId, placement }` | 배치 완료 |
| `move` | `{ matchId, uci }` | 수 두기 |
| `legal-moves` | `{ matchId, square }` | 합법수 요청 |
| `resign` | `{ matchId }` | 기권 |
| `draw:offer` | `{ matchId }` | 무승부 제안 |
| `draw:accept` | `{ matchId }` | 무승부 수락 |
| `draw:reject` | `{ matchId }` | 무승부 거절 |
| `spectate:join` | `{ matchId }` | 관전 시작 |
| `spectate:leave` | `{ matchId }` | 관전 종료 |

#### 서버 → 클라이언트

| Event | Payload | 설명 |
|-------|---------|------|
| `room-created` | `{ matchId, color }` | 방 생성 완료 |
| `player-joined` | `{ matchId, opponent }` | 상대 입장 |
| `placement:start` | `{ matchId, timeLimit }` | 배치 단계 시작 |
| `placement:complete` | `{ board, currentTurn }` | 배치 완료, 게임 시작 |
| `move-made` | `{ uci, board, turn, pgn, isCheck }` | 수 완료 |
| `legal-moves` | `{ moves, gameState }` | 합법수 응답 |
| `game-over` | `{ winner, reason, ratingChanges }` | 게임 종료 |
| `timer-update` | `{ white, black }` | 타이머 갱신 |
| `draw:offered` | `{ from }` | 무승부 제안 받음 |
| `draw:rejected` | `{}` | 무승부 거절됨 |
| `spectate:state` | `{ board, turn, pgn, timers }` | 관전 상태 동기화 |
| `error` | `{ message }` | 에러 발생 |

---

## 🚀 배포 구성 및 개발 환경

### 서버 구조

<img width="1834" height="828" alt="image" src="https://github.com/user-attachments/assets/3ad20eb7-62ea-436e-baee-b651ed06b2bf" />


### Nginx 설정

```nginx
# /etc/nginx/sites-available/madchess
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 인증서 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 정적 파일 (React 빌드)
    root /var/www/madchess;
    index index.html;

    # SPA 라우팅
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 프록시
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO 프록시
    location /socket.io {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 타임아웃 설정
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### PM2 설정

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'madchess-backend',
    script: 'dist/index.js',
    cwd: '/var/www/madchess/backend',
    instances: 1,  // Socket.IO는 단일 인스턴스 권장
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/var/log/pm2/madchess-error.log',
    out_file: '/var/log/pm2/madchess-out.log',
    time: true
  }]
}
```

### 환경 변수

```bash
# Backend (.env)
DATABASE_URL="postgresql://user:password@localhost:5432/madchess"
PORT=4000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key

# Frontend (.env)
VITE_API_URL=https://your-domain.com/api
VITE_SOCKET_URL=https://your-domain.com
```

### 배포 스크립트

```bash
#!/bin/bash
# deploy.sh

# 1. 코드 가져오기
cd /var/www/madchess
git pull origin main

# 2. 프론트엔드 빌드
cd frontend
npm ci
npm run build
cp -r dist/* /var/www/madchess/

# 3. 백엔드 빌드 및 재시작
cd ../backend
npm ci
npm run build
npx prisma migrate deploy
pm2 restart madchess-backend

# 4. Nginx 설정 테스트 및 리로드
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment complete!"
```

---

## 🔧 로컬 개발 환경 설정

### 사전 요구사항
- Node.js 18.x 이상
- PostgreSQL 15.x
- npm 또는 yarn

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/your-repo/madchess.git
cd madchess

# 2. 백엔드 설정
cd backend
npm install
cp .env.example .env  # 환경변수 설정
npx prisma migrate dev
npm run dev

# 3. 프론트엔드 설정 (새 터미널)
cd frontend
npm install
cp .env.example .env  # 환경변수 설정
npm run dev
```

### 접속
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:4000/api
- Socket.IO: http://localhost:4000

---

## 📄 라이선스

MIT License

---

## 👥 팀원

- **탁한진** - 백엔드 담당, 서버 호스팅
- **정재우** - 프론트엔드 담당, 스크럼

---

<p align="center">
  Made with ♟️ and ☕ by MadChess Team
</p>
