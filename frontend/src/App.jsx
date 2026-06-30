import { Routes, Route } from 'react-router-dom'
import { useTheme } from './hooks/useTheme.js'
import { useAuth } from './hooks/useAuth.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import AuthModal from './components/AuthModal.jsx'
import HomePage from './pages/HomePage.jsx'
import BoardDetailPage from './pages/BoardDetailPage.jsx'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  // The modal lives at the app root, but its open state + queued post-login
  // action are owned by AuthProvider so any nested component can call
  // requireAuth() to gate a mutation behind sign-in.
  const { user, logout, authModal, openAuth, closeAuth, setUser } = useAuth()

  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onRequestAuth={openAuth}
        onLogout={logout}
      />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/boards/:boardId" element={<BoardDetailPage />} />
        </Routes>
      </main>
      <Footer />

      <AuthModal
        open={authModal.open}
        mode={authModal.mode}
        onClose={closeAuth}
        onAuthenticated={setUser}
      />
    </>
  )
}
