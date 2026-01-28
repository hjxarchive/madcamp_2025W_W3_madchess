import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, isAuthenticated, login, checkAuth } = useAuthStore()

    const from = location.state?.from?.pathname || '/'

    useEffect(() => {
        checkAuth()
    }, [])

    const handleLogin = () => {
        // 현재 위치(리다이렉트 될 곳)를 저장
        if (from && from !== '/' && from !== '/login') {
            localStorage.setItem('loginRedirect', from)
        }
        login()
    }

    useEffect(() => {
        if (isAuthenticated && user) {
            // 저장된 리다이렉트 경로 확인
            const savedRedirect = localStorage.getItem('loginRedirect')
            if (savedRedirect) {
                localStorage.removeItem('loginRedirect')
                navigate(savedRedirect, { replace: true })
            } else {
                navigate('/', { replace: true })
            }
        }
    }, [isAuthenticated, user, navigate])

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans tracking-wide">
            {/* Background Accent */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#D4FF00] rounded-full blur-[120px] opacity-5"></div>
            </div>

            <div className="z-10 text-center max-w-md w-full px-6">
                {/* Logo Area */}
                <div className="mb-12">
                    <div className="w-16 h-16 bg-white mx-auto mb-6 skew-x-12 relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-80"></div>
                        <span className="text-3xl font-black skew-x-[-12deg] text-black z-10">M</span>
                    </div>
                    <h1 className="text-6xl font-serif font-light leading-none mb-2">
                        <span className="text-white">MAD</span>
                        <span className="text-[#D4FF00]">CHESS</span>
                    </h1>
                    <p className="text-gray-500 uppercase tracking-widest text-sm font-medium mt-4">The Arena for Grandmasters</p>
                </div>

                {/* Login Button */}
                <button
                    onClick={handleLogin}
                    className="group w-full bg-transparent border border-gray-700 hover:border-[#D4FF00] text-white py-4 px-6 transition-all duration-300 flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-1 rounded-sm">
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="w-4 h-4"
                            />
                        </div>
                        <span className="uppercase font-bold tracking-wider group-hover:text-[#D4FF00] transition-colors">Login with Google</span>
                    </div>
                    <span className="text-gray-500 group-hover:text-[#D4FF00] group-hover:translate-x-1 transition-all">→</span>
                </button>

                {/* Footer Text */}
                <p className="mt-8 text-xs text-gray-600 uppercase tracking-widest">
                    By logging in, you accept the rules of the arena.
                </p>
            </div>
        </div>
    )
}
