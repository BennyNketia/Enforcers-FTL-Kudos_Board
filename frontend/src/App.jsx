import { useState } from 'react'
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
  const { user, setUser, logout } = useAuth()

  // Auth modal lives at the app root so it can be opened from anywhere (Header).
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' })
  const openAuth = (mode = 'login') => setAuthModal({ open: true, mode })
  const closeAuth = () => setAuthModal((s) => ({ ...s, open: false }))

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
