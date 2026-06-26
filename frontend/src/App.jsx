import { Routes, Route } from 'react-router-dom'
import { useTheme } from './hooks/useTheme.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import HomePage from './pages/HomePage.jsx'
import BoardDetailPage from './pages/BoardDetailPage.jsx'

export default function App() {
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/boards/:boardId" element={<BoardDetailPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
