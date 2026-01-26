# Mad Chess - 기술 스택 및 백엔드 아키텍처

## 📚 기술 스택 (Tech Stack)

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| **React** | 18.2 | UI 라이브러리 |
| **TypeScript** | 5.3 | 타입 안전성 |
| **Vite** | 5.0 | 빌드 도구 & 개발 서버 |
| **React Router** | 6.21 | 클라이언트 라우팅 |
| **Tailwind CSS** | 3.4 | 스타일링 |
| **Zustand** | 4.5 | 상태 관리 (Auth Store) |
| **Axios** | 1.13 | HTTP 클라이언트 |
| **Socket.IO Client** | 4.6 | 실시간 통신 |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| **Node.js** | 20.x | 런타임 |
| **Express** | 4.18 | 웹 프레임워크 |
| **TypeScript** | 5.3 | 타입 안전성 |
| **Prisma** | 5.8 | ORM (데이터베이스 접근) |
| **PostgreSQL** | 15.x | 관계형 데이터베이스 |
| **Socket.IO** | 4.8 | 실시간 양방향 통신 |
| **Passport.js** | 0.7 | 인증 미들웨어 |
| **Passport Google OAuth** | 2.0 | Google 로그인 |
| **Swagger** | 6.2 | API 문서화 |

### Infrastructure
| 기술 | 용도 |
|------|------|
| **AWS EC2** | 서버 호스팅 |
| **Nginx** | 리버스 프록시 & 정적 파일 서빙 |
| **PM2** | Node.js 프로세스 관리 |
| **Let's Encrypt** | SSL 인증서 |

---

## 🗄️ 데이터베이스 스키마

```mermaid
erDiagram
    user ||--o{ deck : "owns"
    user ||--o{ game : "plays as white"
    user ||--o{ game : "plays as black"
    user ||--o{ game_history : "has"
    
    deck ||--o{ deck_composition : "contains"
    deck ||--o{ game : "used in (white)"
    deck ||--o{ game : "used in (black)"
    
    piece ||--o{ deck_composition : "included in"
    
    game ||--o{ game_history : "records"

    user {
        int id PK
        string username UK
        string email UK
        string google_id UK
        string picture
        int rating
        float volatility
        float rd
        datetime created_at
    }
    
    deck {
        int id PK
        string name
        int user_id FK
        int win_cnt
        int lose_cnt
        int total_p_val
        datetime created_at
    }
    
    piece {
        int id PK
        string name UK
        int value
        string action
        string img_url
    }
    
    deck_composition {
        int deck_id PK_FK
        int piece_id PK_FK
        int quantity
    }
    
    game {
        int id PK
        int white_player_id FK
        int black_player_id FK
        int white_deck_id FK
        int black_deck_id FK
        string initial_fen
        string pgn
        string result
        datetime played_at
    }
    
    game_history {
        int user_id PK_FK
        int game_id PK_FK
        string role
        string result
        int rating_change
    }
```

---

## 🏗️ 백엔드 아키텍처

### 모듈 구조

```
backend/src/
├── server.ts              # 진입점 (Express + Socket.IO 설정)
├── config/
│   └── passport.ts        # Google OAuth 설정
├── routes/
│   └── auth.ts            # 인증 라우트
├── modules/
│   ├── user/              # 사용자 모듈
│   │   ├── user.routes.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.repository.ts
│   ├── deck/              # 덱 모듈
│   │   ├── deck.routes.ts
│   │   ├── deck.controller.ts
│   │   ├── deck.service.ts
│   │   └── deck.repository.ts
│   ├── piece/             # 기물 모듈
│   │   ├── piece.routes.ts
│   │   ├── piece.controller.ts
│   │   ├── piece.service.ts
│   │   └── piece.repository.ts
│   └── game/              # 게임 모듈
│       ├── game.routes.ts
│       ├── game.controller.ts
│       ├── game.service.ts
│       └── game.repository.ts
├── socket/
│   └── handlers.ts        # Socket.IO 이벤트 핸들러
└── utils/
    └── prisma.ts          # Prisma 클라이언트 인스턴스
```

### 레이어드 아키텍처

```mermaid
flowchart TB
    subgraph Client["🌐 Client (React)"]
        UI[UI Components]
        Store[Zustand Store]
        API[API Service]
        Socket[Socket Client]
    end

    subgraph Server["🖥️ Server (Express)"]
        subgraph Routes["Routes Layer"]
            AuthRoute["/api/auth"]
            UserRoute["/api/users"]
            DeckRoute["/api/decks"]
            PieceRoute["/api/pieces"]
            GameRoute["/api/games"]
        end
        
        subgraph Controllers["Controller Layer"]
            UserCtrl[UserController]
            DeckCtrl[DeckController]
            PieceCtrl[PieceController]
            GameCtrl[GameController]
        end
        
        subgraph Services["Service Layer (Business Logic)"]
            UserSvc[UserService]
            DeckSvc[DeckService]
            PieceSvc[PieceService]
            GameSvc[GameService]
        end
        
        subgraph Repositories["Repository Layer (Data Access)"]
            UserRepo[UserRepository]
            DeckRepo[DeckRepository]
            PieceRepo[PieceRepository]
            GameRepo[GameRepository]
        end
        
        subgraph SocketIO["Socket.IO"]
            Handlers[Socket Handlers]
        end
    end

    subgraph DB["🗄️ PostgreSQL"]
        Tables[(Tables)]
    end

    UI --> API
    UI --> Socket
    API --> Routes
    Socket --> SocketIO
    
    Routes --> Controllers
    Controllers --> Services
    Services --> Repositories
    Repositories --> DB
    
    Handlers --> Services
```

---

## 🔌 Socket.IO 이벤트 흐름

### 매칭 & 게임 플로우

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant Server as Socket Server
    participant P2 as Player 2

    Note over P1,P2: 🎯 매칭 단계
    P1->>Server: createRoom(color)
    Server->>P1: roomCreated(roomCode)
    P2->>Server: joinRoom(roomCode)
    Server->>P1: opponentJoined
    Server->>P2: roomJoined(gameId)
    
    Note over P1,P2: 📦 배치 단계
    P1->>Server: placement:submit(pieces)
    Server->>P1: placement:waiting
    P2->>Server: placement:submit(pieces)
    Server->>P1: placement:complete(opponentPieces)
    Server->>P2: placement:complete(opponentPieces)
    
    Note over P1,P2: ♟️ 게임 단계
    P1->>Server: move(from, to)
    Server->>P1: moveResult(success)
    Server->>P2: opponentMove(from, to)
    
    loop 게임 진행
        P2->>Server: move(from, to)
        Server->>P2: moveResult(success)
        Server->>P1: opponentMove(from, to)
    end
    
    Note over P1,P2: 🏆 게임 종료
    Server->>P1: gameOver(result)
    Server->>P2: gameOver(result)
```

### Socket 이벤트 목록

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `createRoom` | Client → Server | 새 게임 방 생성 |
| `roomCreated` | Server → Client | 방 코드 전달 |
| `joinRoom` | Client → Server | 방 참가 요청 |
| `roomJoined` | Server → Client | 참가 성공 |
| `opponentJoined` | Server → Client | 상대방 입장 알림 |
| `placement:submit` | Client → Server | 기물 배치 제출 |
| `placement:waiting` | Server → Client | 상대 배치 대기 |
| `placement:complete` | Server → Client | 양쪽 배치 완료 |
| `move` | Client → Server | 수 제출 |
| `moveResult` | Server → Client | 수 결과 |
| `opponentMove` | Server → Client | 상대방 수 알림 |
| `gameOver` | Server → Client | 게임 종료 |

---

## 🔐 인증 흐름 (Google OAuth)

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Frontend as Frontend
    participant Backend as Backend
    participant Google as Google OAuth

    User->>Frontend: "Google 로그인" 클릭
    Frontend->>Backend: GET /api/auth/google
    Backend->>Google: OAuth 인증 요청
    Google->>User: 로그인 페이지 표시
    User->>Google: 로그인 승인
    Google->>Backend: 인증 코드 + 프로필
    Backend->>Backend: 사용자 생성/조회
    Backend->>Frontend: 세션 생성 + 리다이렉트
    Frontend->>Backend: GET /api/auth/me
    Backend->>Frontend: 사용자 정보 반환
    Frontend->>Frontend: Zustand Store 업데이트
```

---

## 📡 API 엔드포인트 요약

| 메소드 | 경로 | 설명 |
|--------|------|------|
| **Auth** |
| GET | `/api/auth/google` | Google OAuth 시작 |
| GET | `/api/auth/google/callback` | OAuth 콜백 |
| GET | `/api/auth/me` | 현재 사용자 정보 |
| POST | `/api/auth/logout` | 로그아웃 |
| **Users** |
| GET | `/api/users/:id` | 사용자 조회 |
| GET | `/api/users/:id/decks` | 사용자 덱 목록 |
| GET | `/api/users/:id/stats` | 사용자 통계 |
| **Decks** |
| POST | `/api/decks` | 덱 생성 |
| GET | `/api/decks/:id` | 덱 상세 조회 |
| PUT | `/api/decks/:id` | 덱 수정 |
| DELETE | `/api/decks/:id` | 덱 삭제 |
| POST | `/api/decks/validate` | 덱 검증 |
| **Pieces** |
| GET | `/api/pieces` | 모든 기물 조회 |
| GET | `/api/pieces/:id` | 기물 상세 조회 |
| **Games** |
| POST | `/api/games` | 게임 생성 |
| GET | `/api/games/:id` | 게임 조회 |
| PUT | `/api/games/:id` | 게임 업데이트 (결과) |

---

## 🎮 덱 검증 로직

```mermaid
flowchart TD
    A[덱 구성 입력] --> B{킹이 포함되어 있나?}
    B -->|No| C[❌ KING_REQUIRED]
    B -->|Yes| D{각 기물 개수가 제한 내인가?}
    D -->|No| E[❌ PIECE_COUNT_EXCEEDED]
    D -->|Yes| F{총 비용이 30점 이하인가?}
    F -->|No| G[❌ BUDGET_EXCEEDED]
    F -->|Yes| H[✅ 덱 유효]
    
    style C fill:#ff6b6b
    style E fill:#ff6b6b
    style G fill:#ff6b6b
    style H fill:#51cf66
```

### 기물 제한

| 기물 | 최대 개수 | 비용 (pts) |
|------|----------|-----------|
| King (k) | 1 (필수) | 0 |
| Queen (q) | 1 | 9 |
| Rook (r) | 2 | 5 |
| Bishop (b) | 2 | 3 |
| Knight (n) | 2 | 3 |
| Pawn (p) | 8 | 1 |

**총 예산: 30점**

---

## 🚀 배포 구성

```mermaid
flowchart LR
    subgraph Client["Client Browser"]
        React[React App]
    end
    
    subgraph AWS["AWS EC2"]
        subgraph Nginx["Nginx"]
            Static["/var/www/chess (Static Files)"]
            Proxy["Reverse Proxy :5001"]
        end
        
        subgraph PM2["PM2"]
            Node["Node.js Backend"]
        end
    end
    
    subgraph DB["PostgreSQL"]
        Database[(Database)]
    end
    
    React -->|HTTPS :443| Nginx
    Nginx -->|Static Files| Static
    Nginx -->|API & WebSocket| Proxy
    Proxy --> Node
    Node --> Database
```

---

*© 2024 Mad Chess Studio*
