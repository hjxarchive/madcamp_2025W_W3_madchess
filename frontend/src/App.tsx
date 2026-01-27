import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MatchmakingPage from './pages/MatchmakingPage'
import PlacementPage from './pages/PlacementPage'
import GamePage from './pages/GamePage'
import DeckBuilderPage from './pages/DeckBuilderPage'
import MyPage from './pages/MyPage'
import ReplayPage from './pages/ReplayPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route
            path="/matchmaking"
            element={
              <ProtectedRoute>
                <MatchmakingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/placement/:gameId"
            element={
              <ProtectedRoute>
                <PlacementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:gameId"
            element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/replay/:gameId"
            element={
              <ProtectedRoute>
                <ReplayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deck-builder"
            element={
              <ProtectedRoute>
                <DeckBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mypage"
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
