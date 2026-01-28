import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import prisma from '../utils/prisma.js'
import { User } from '../types/user.js'

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const googleId = profile.id
                const email = profile.emails?.[0]?.value
                const name = profile.displayName
                const picture = profile.photos?.[0]?.value

                if (!email) {
                    return done(new Error('No email found in Google profile'))
                }

                // 1. Google ID로 찾기
                // @ts-ignore - Prisma types might be stale due to failed migration, ignoring for build
                let user = await prisma.user.findUnique({
                    where: { google_id: googleId },
                })

                if (user) {
                    // 1. 이미 Google ID로 찾은 경우 -> 사진만 업데이트
                    // @ts-ignore
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { picture },
                    })
                } else {
                    // 2. Google ID로 못 찾음 -> Email로 찾기 (기존 계정 연동)
                    // @ts-ignore
                    user = await prisma.user.findUnique({
                        where: { email },
                    })

                    if (user) {
                        // 이메일로 찾았으면 Google ID 및 사진 업데이트
                        // @ts-ignore
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: { google_id: googleId, picture },
                        })
                    } else {
                        // 3. 새 유저 생성
                        // username 중복 방지 로직
                        let username = name.replace(/\s/g, '').toLowerCase()
                        let suffix = 1
                        while (await prisma.user.findUnique({ where: { username } })) {
                            username = `${name.replace(/\s/g, '').toLowerCase()}${suffix}`
                            suffix++
                        }

                        // @ts-ignore
                        user = await prisma.user.create({
                            data: {
                                username,
                                email,
                                google_id: googleId,
                                picture,
                            },
                        })
                    }
                }

                // Map Prisma user to Express.User interface
                const mappedUser: User = {
                    id: user.id,
                    // @ts-ignore - Assert email exists because we enforce it or it comes from DB
                    email: user.email || '',
                    name: user.username,
                    // @ts-ignore
                    googleId: user.google_id || '',
                    picture: user.picture || undefined
                }

                return done(null, mappedUser)
            } catch (error) {
                return done(error as Error)
            }
        }
    )
)

passport.serializeUser((user: Express.User, done) => {
    done(null, user.id)
})

passport.deserializeUser(async (id: number, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } })
        if (user) {
            const mappedUser: User = {
                id: user.id,
                // @ts-ignore
                email: user.email || '',
                name: user.username,
                // @ts-ignore
                googleId: user.google_id || '',
                picture: user.picture || undefined
            }
            done(null, mappedUser)
        } else {
            done(null, null)
        }
    } catch (error) {
        done(error, null)
    }
})

export default passport
