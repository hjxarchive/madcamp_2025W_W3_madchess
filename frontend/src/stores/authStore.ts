import { create } from 'zustand'

interface User {
    id: number
    email: string
    name: string
    picture?: string
    googleId: string
}

interface AuthStore {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    login: () => void
    logout: () => void
    checkAuth: () => Promise<void>
    setUser: (user: User) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: () => {
        // Google 로그인 페이지로 리디렉션
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://3.35.93.217:3001'
        window.location.href = `${apiUrl}/api/auth/google`
    },

    logout: () => {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://3.35.93.217:3001'
        window.location.href = `${apiUrl}/api/auth/logout`
        set({ user: null, isAuthenticated: false })
    },

    checkAuth: async () => {
        try {
            set({ isLoading: true })
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://3.35.93.217:3001'
            const response = await fetch(`${apiUrl}/api/auth/user`, {
                credentials: 'include' // 세션 쿠키 포함
            })

            if (response.ok) {
                const user = await response.json()
                set({ user, isAuthenticated: true })
            } else {
                set({ user: null, isAuthenticated: false })
            }
        } catch (error) {
            console.error('Auth check failed:', error)
            set({ user: null, isAuthenticated: false })
        } finally {
            set({ isLoading: false })
        }
    },

    setUser: (user: User) => {
        set({ user })
    }
}))
