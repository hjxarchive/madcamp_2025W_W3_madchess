import { Link } from 'react-router-dom'

export default function DeckBuilderPage() {
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">덱 빌더</h1>
        <Link to="/" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
          홈으로
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card Collection */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">카드 컬렉션</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 cursor-pointer transition-colors">
                <div className="aspect-[3/4] bg-gray-600 rounded mb-2 flex items-center justify-center">
                  <span className="text-4xl">♟</span>
                </div>
                <p className="text-sm font-semibold">Card {i}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Current Deck */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">현재 덱</h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">카드 수: 0/30</p>
            <div className="bg-gray-700 rounded p-4 min-h-[200px] flex items-center justify-center">
              <p className="text-gray-500">카드를 추가하세요</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
