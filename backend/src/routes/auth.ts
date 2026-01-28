import express from 'express'
import passport from '../config/passport.js'

const router = express.Router()

// Google 로그인 시작
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
)

// Google 콜백
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // 성공 시 쿼리 파라미터로 userId 전달 (선택사항, 프론트에서 /auth/user로 확인 가능)
        // 성공 시 쿼리 파라미터로 userId 전달 (선택사항, 프론트에서 /auth/user로 확인 가능)
        res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:3000'}/login`)
    }
)

// 로그아웃
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' })
        }
        // 세션 쿠키 삭제 (선택사항)
        req.session.destroy((err) => {
            res.clearCookie('connect.sid'); // express-session 기본 쿠키 이름
            res.redirect(process.env.CORS_ORIGIN || 'http://localhost:3000');
        });
    })
})

// 현재 사용자 정보 확인
router.get('/user', (req, res) => {
    if (req.isAuthenticated()) {
        const user = req.user as any
        
        // Glicko-2 레이팅 정보 추가
        const rd = user.rd || 350
        const confidenceMargin = Math.round(1.96 * rd)
        
        res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            picture: user.picture,
            rating: user.rating || 1500,
            rd: rd,
            volatility: user.volatility || 0.06,
            ratingDisplay: `${Math.round(user.rating || 1500)} ± ${confidenceMargin}`,
            isProvisional: rd > 100,
            createdAt: user.created_at
        })
    } else {
        res.status(401).json({ error: 'Not authenticated' })
    }
})

export default router
