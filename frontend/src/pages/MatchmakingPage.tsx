import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const KING_IMAGES = {
  white: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  black: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
}

export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [selectedColor, setSelectedColor] = useState<'white' | 'black' | null>(null)

  const handleSelectColor = (color: 'white' | 'black') => {
    setSelectedColor(color)
  }

  const handleProceed = () => {
    if (!selectedColor) return
    
    // 임시 게임 ID 생성
    const gameId = `game-${Date.now()}`
    
    // 배치 페이지로 이동 (색상 정보를 쿼리/상태로 전달)
    // 여기서는 sessionStorage를 사용하여 색상 정보를 임시 저장
    sessionStorage.setItem('selectedColor', selectedColor)
    navigate(`/placement/${gameId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800 rounded-lg p-8 shadow-2xl">
          <h1 className="text-4xl font-bold mb-2 text-center">매칭</h1>
          <p className="text-gray-400 text-center mb-8">
            선/후공을 선택해주세요
          </p>

          {/* 선/후공 선택 */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* 선공 - 백 */}
            <button
              onClick={() => handleSelectColor('white')}
              className={`
                p-8 rounded-lg transition-all duration-300 border-2
                ${selectedColor === 'white'
                  ? 'border-blue-500 bg-blue-900 shadow-lg'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }
              `}
            >
              <div className="flex justify-center mb-4">
                <img src={KING_IMAGES.white} alt="White King" className="w-20 h-20" />
              </div>
              <div className="text-xl font-bold mb-2 text-center">선공 (백)</div>
              <div className="text-sm text-gray-300 text-center">
                먼저 움직일 수 있습니다
              </div>
            </button>

            {/* 후공 - 흑 */}
            <button
              onClick={() => handleSelectColor('black')}
              className={`
                p-8 rounded-lg transition-all duration-300 border-2
                ${selectedColor === 'black'
                  ? 'border-blue-500 bg-blue-900 shadow-lg'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }
              `}
            >
              <div className="flex justify-center mb-4">
                <img src={KING_IMAGES.black} alt="Black King" className="w-20 h-20" />
              </div>
              <div className="text-xl font-bold mb-2 text-center">후공 (흑)</div>
              <div className="text-sm text-gray-300 text-center">
                상대가 먼저 움직입니다
              </div>
            </button>
          </div>

          {/* 진행 버튼 */}
          <button
            onClick={handleProceed}
            disabled={!selectedColor}
            className={`
              w-full py-3 rounded-lg font-bold text-lg transition-colors
              ${selectedColor
                ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            배치하기
          </button>

          {/* 취소 버튼 */}
          <button
            onClick={() => window.history.back()}
            className="w-full mt-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
