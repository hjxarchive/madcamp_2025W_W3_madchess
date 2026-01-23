import { useParams } from 'react-router-dom'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4">Game: {gameId}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Game Board */}
        <div className="lg:col-span-3 bg-gray-800 rounded-lg p-4">
          <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">체스 보드 영역</p>
          </div>
        </div>
        
        {/* Side Panel */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">덱 & 정보</h2>
          <div className="space-y-4">
            <div className="bg-gray-700 p-3 rounded">
              <p className="text-sm text-gray-400">플레이어 1</p>
              <p className="font-semibold">You</p>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <p className="text-sm text-gray-400">플레이어 2</p>
              <p className="font-semibold">Opponent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
