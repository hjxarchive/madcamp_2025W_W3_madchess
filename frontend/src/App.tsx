import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import MatchmakingPage from './pages/MatchmakingPage'
import PlacementPage from './pages/PlacementPage'
import GamePage from './pages/GamePage'
import DeckBuilderPage from './pages/DeckBuilderPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/matchmaking" element={<MatchmakingPage />} />
          <Route path="/placement/:gameId" element={<PlacementPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/deck-builder" element={<DeckBuilderPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
