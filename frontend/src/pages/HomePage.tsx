import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-6xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        Deck Chess
      </h1>
      <p className="text-xl text-gray-300 mb-12 text-center max-w-2xl">
        전략적인 덱 빌딩과 체스를 결합한 PVP 게임
      </p>
      <div className="flex gap-4">
        <Link 
          to="/deck-builder" 
          className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-lg font-semibold transition-colors"
        >
          덱 빌더
        </Link>
        <button className="px-8 py-4 bg-pink-600 hover:bg-pink-700 rounded-lg text-lg font-semibold transition-colors">
          게임 시작
        </button>
      </div>
    </div>
  )
}
