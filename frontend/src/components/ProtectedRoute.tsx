import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface ProtectedRouteProps {
    children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    // 로컬 개발 환경에서는 auth 체크 무시
    const isDevelopment = !import.meta.env.PROD

    if (isLoading && !isDevelopment) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-white text-xl">Loading...</div>
            </div>
        )
    }

    // 개발 환경이면 항상 통과, 프로덕션이면 인증 확인
    if (!isDevelopment && !isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}
