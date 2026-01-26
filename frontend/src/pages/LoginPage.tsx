import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
    const navigate = useNavigate()
    const { user, isAuthenticated, login, checkAuth } = useAuthStore()

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (isAuthenticated && user) {
            navigate('/matchmaking')
        }
    }, [isAuthenticated, user, navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">♟️ MadChess</h1>
                    <p className="text-gray-500">전략적인 체스 배틀을 시작하세요</p>
                </div>

                <button
                    onClick={login}
                    className="w-full bg-white border border-gray-300 text-gray-700 px-6 py-4 rounded-xl font-medium hover:bg-gray-50 transition flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        className="w-6 h-6"
                    />
                    <span className="text-lg">Google 계정으로 시작하기</span>
                </button>

                <div className="mt-8 text-xs text-gray-400">
                    로그인함으로써 이용약관 및 개인정보처리방침에 동의합니다.
                </div>
            </div>
        </div>
    )
}
