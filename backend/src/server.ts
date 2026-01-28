import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import session from 'express-session'
import passport from './config/passport.js'
import authRoutes from './routes/auth.js'
import { setupSocketHandlers } from './socket/handlers.js'

// Routes
import userRoutes from './modules/user/user.routes.js'
import deckRoutes from './modules/deck/deck.routes.js'
import pieceRoutes from './modules/piece/piece.routes.js'
import gameRoutes from './modules/game/game.routes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
})

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())

// Trust Proxy for Nginx
app.set('trust proxy', 1)

// Session 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'madcamp_chess_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS에서만 true, 현재는 false 추천 (Nginx SSL Offloading 고려)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
}))

// Passport 초기화
app.use(passport.initialize())
app.use(passport.session())

// Auth Routres
app.use('/api/auth', authRoutes)

io.on('connection', (socket) => {
  console.log('🔌 새로운 유저 접속:', socket.id);

  // 1. 방 참가 이벤트 ('joinGame')
  socket.on('joinGame', (roomName) => {
    // 유저를 해당 방에 넣습니다.
    socket.join(roomName);
    console.log(`유저(${socket.id})가 방([${roomName}])에 입장했습니다.`);

    // 나를 제외한 방 안의 다른 사람들에게 알림을 보냅니다.
    socket.to(roomName).emit('notification', `${socket.id} 님이 입장하셨습니다.`);

    // 입장한 나 자신에게도 환영 메시지를 보냅니다.
    socket.emit('notification', `방 [${roomName}]에 입장 성공!`);
  });

  // 2. 방 안에서만 대화하기 ('roomMessage')
  socket.on('roomMessage', (data) => {
    const { roomName, message } = data;
    console.log(`[${roomName}] 메시지: ${message}`);

    // io.to(방이름).emit: 그 방에 있는 '모든' 사람에게 전송
    io.to(roomName).emit('message', `[방 ${roomName}] ${socket.id}: ${message}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ 유저 접속 해제:', socket.id);
  });
});

// Swagger 설정 옵션 정의
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Deck Chess API',
      version: '1.0.0',
      description: 'API Documentation for Deck Chess Game',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5001}`,
      },
    ],
  },
  // API 주석을 읽어올 파일 위치 지정
  apis: ['./src/**/*.ts'],
}

// Swagger 문서 생성
console.log(`📚 API Docs available at http://localhost:${PORT}/api-docs`)
const swaggerDocs = swaggerJsdoc(swaggerOptions)

// Swagger UI 라우트
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

// Basic route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// API Routes
app.use('/api/users', userRoutes)
app.use('/api/decks', deckRoutes)
app.use('/api/pieces', pieceRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/leaderboard', userRoutes)

// Setup Socket.IO handlers
setupSocketHandlers(io)



httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 Socket.IO server ready`)
  console.log(`📍 API available at http://localhost:${PORT}/api`)
})
