import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
// ИМПОРТЫ ДЛЯ TanStack Query и Toast
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast' // Импортируем Toaster
// --- НОВЫЕ ИМПОРТЫ ДЛЯ I18N ---
import './i18n-next' // инициализация i18next (старая система живёт в ./i18n/)
import { useTranslation } from 'react-i18next'
// --------------------------
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import CookieBanner from './components/CookieBanner'

// Создаем клиент для TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 минут
      gcTime: 10 * 60 * 1000, // 10 минут (в react-query v5 cacheTime переименован)
    },
    mutations: {
      // Глобальная обработка ошибок для мутаций
      onError: (error) => {
        toast.error(error.message || 'Une erreur est survenue'); // сообщение пользователю — по-французски
      },
    },
  },
})

const Home             = lazy(() => import('./pages/Home'))
const ItemDetail       = lazy(() => import('./pages/ItemDetail'))
const ListItem         = lazy(() => import('./pages/ListItem'))
const EditItem         = lazy(() => import('./pages/EditItem'))
const MyItems          = lazy(() => import('./pages/MyItems'))
const MyRentals        = lazy(() => import('./pages/MyRentals'))
const Profile          = lazy(() => import('./pages/Profile'))
const Login            = lazy(() => import('./pages/Login'))
const Register         = lazy(() => import('./pages/Register'))
const ForgotPassword   = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword    = lazy(() => import('./pages/ResetPassword'))
const Admin            = lazy(() => import('./pages/Admin'))
const Landing          = lazy(() => import('./pages/Landing'))
const Privacy          = lazy(() => import('./pages/Privacy'))
const Terms            = lazy(() => import('./pages/Terms'))

function Navbar() {
  const { t, i18n } = useTranslation() // Используем хук i18next
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const close = () => setMenuOpen(false)

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr'
    i18n.changeLanguage(newLang)
    close()
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" onClick={close}>RentIt</Link>
        <button className="navbar-burger" onClick={() => setMenuOpen((o: boolean) => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
          <Link to="/browse" className="navbar-link" onClick={close}>{t('browse')}</Link>
          {user ? (
            <>
              <Link to="/list-item" className="navbar-link" onClick={close}>{t('listItem')}</Link>
              <Link to="/my-items" className="navbar-link hide-mobile" onClick={close}>{t('myItems')}</Link>
              <Link to="/my-rentals" className="navbar-link hide-mobile" onClick={close}>{t('myRentals')}</Link>
              <Link to="/profile" className="navbar-link" onClick={close}>{t('navProfile')}</Link>
              <button
                onClick={() => { logout(); close() }}
                style={{ background: 'none', border: 'none', color: 'rgba(242,240,235,0.4)', fontSize: '13px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                {t('logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link" onClick={close}>{t('login')}</Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>{t('signup')}</Link>
            </>
          )}
          <button
            onClick={toggleLanguage}
            style={{
              background: 'none', border: '1px solid rgba(242,240,235,0.2)',
              borderRadius: '3px', color: 'rgba(242,240,235,0.5)',
              fontSize: '11px', fontFamily: 'var(--font-mono)',
              padding: '5px 10px', cursor: 'pointer', letterSpacing: '0.08em',
            }}
          >
            {i18n.language === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <CookieBanner />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/browse" element={<Home />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/list-item" element={loading ? null : user ? <ListItem /> : <Navigate to="/login" />} />
            <Route path="/edit-item/:id" element={loading ? null : user ? <EditItem /> : <Navigate to="/login" />} />
            <Route path="/my-items" element={loading ? null : user ? <MyItems /> : <Navigate to="/login" />} />
            <Route path="/my-rentals" element={loading ? null : user ? <MyRentals /> : <Navigate to="/login" />} />
            <Route path="/profile" element={loading ? null : user ? <Profile /> : <Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={loading ? null : user ? <Admin /> : <Navigate to="/login" />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* Отложено 11.08 вместе с переходом на бесплатную модель:
                /pro · /business · /business/dashboard · /pay/:bookingId
                Страницы целиком лежат в parked/ — там же как их оживить.
                В src/ их держать нельзя: страж утверждений даёт 14
                срабатываний на тарифах и страховке, и был бы прав. */}
            <Route path="*" element={
              <div className="page" style={{ textAlign: 'center', paddingTop: '120px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '16px' }}>404</div>
                <h1 style={{ fontSize: '48px', fontWeight: '800', letterSpacing: '-0.03em', marginBottom: '16px' }}>Page introuvable</h1>
                <p style={{ color: 'var(--muted)', marginBottom: '32px' }}>Cette page n'existe pas ou a été supprimée.</p>
                <Link to="/browse" className="btn btn-primary">Parcourir les outils →</Link>
              </div>
            } />
          </Routes>
        </Suspense>
        {pathname !== '/' && (
          <footer style={{ textAlign: 'center', padding: '24px 16px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{t('forRentalShops')}</span>
          </footer>
        )}
        <Toaster position="bottom-right" />
      </div>
    </QueryClientProvider>
  )
}