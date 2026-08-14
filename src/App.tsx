import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
// ИМПОРТЫ ДЛЯ TanStack Query и Toast
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast' // Импортируем Toaster
// --- НОВЫЕ ИМПОРТЫ ДЛЯ I18N ---
import i18n, { LANGUAGES } from './i18n-next' // импорт и инициализация i18next разом
import { useTranslation } from 'react-i18next'
import { useDocumentLanguage } from './hooks/useDocumentLanguage'
// --------------------------
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import CookieBanner from './components/CookieBanner'
import RouteBoundary, { clearChunkReloadFlag } from './components/common/RouteBoundary'

// Создаем клиент для TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 минут
      gcTime: 10 * 60 * 1000, // 10 минут (в react-query v5 cacheTime переименован)
    },
    mutations: {
      // Глобальная обработка ошибок для мутаций.
      //
      // Человеку — словарная строка, разработчику — техническая.
      // Раньше здесь стояло `error?.message || t('errors.generic')`, то
      // есть словарь включался только когда сообщения нет. А сообщение
      // приходит от Supabase и всегда по-английски: французский
      // пользователь получал «permission denied for table users»
      // поверх французской страницы, и это ровно та строка, которую он
      // видел вместо объяснения при блокере 11.08.
      onError: (error) => {
        console.error(error)
        toast.error(i18n.t('errors.generic'))
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
const RentalShops      = lazy(() => import('./pages/RentalShops'))

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

  // Переключатель показывает ТЕКУЩИЙ язык и раскрывает выбор.
  //
  // До 13.08 он работал по кругу и показывал СЛЕДУЮЩИЙ язык: человек стоял
  // на французской странице и видел кнопку «EN», не понимая, это его язык
  // или переход. Меня самого это поймало — оснастка кликала до надписи «EN»,
  // получала французский экран, и я чуть не записал это дефектом перевода.
  // Если подпись обманывает того, кто знает код, посетителя она обманывает
  // тем более.
  //
  // Текущий язык считает `useDocumentLanguage` — тот же, что у «Условий» и
  // «Политики». Своя копия этих трёх строк здесь и была третьим по счёту
  // способом определять язык в продукте.
  const current = useDocumentLanguage()
  const [langOpen, setLangOpen] = useState(false)

  const chooseLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    setLangOpen(false)
    close()
  }

  // Закрытие по клику мимо и по Esc: список перекрывает содержимое, и
  // оставить его открытым — значит держать человека в ловушке на телефоне,
  // где промахнуться мимо мелкой кнопки легко.
  const langRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!langOpen) return
    const onDown = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLangOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [langOpen])

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Правило `.navbar-logo span` красит вторую половину имени
            сигнальным цветом и существовало давно — но span в разметке
            не было, и правило не применялось ни разу. */}
        <Link to="/" className="navbar-logo" onClick={close}>Rent<span>It</span></Link>
        <button className="navbar-burger" onClick={() => setMenuOpen((o: boolean) => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
          <Link to="/browse" className="navbar-link" onClick={close}>{t('browse')}</Link>
          {user ? (
            <>
              {/* Пространство `nav.*`, а не плоские `listItem`/`myItems`/
                  `myRentals`: перенос 121 строки в словари (#30) завёл
                  ПРОСТРАНСТВА ИМЁН с теми же именами, и они затёрли строки
                  навбара. i18next на объекте отдаёт не текст, а
                  «key 'myItems (fr)' returned an object instead of string.» —
                  ровно это и висело в проде у каждого вошедшего. */}
              <Link to="/list-item" className="navbar-link" onClick={close}>{t('nav.listItem')}</Link>
              <Link to="/my-items" className="navbar-link hide-mobile" onClick={close}>{t('nav.myItems')}</Link>
              <Link to="/my-rentals" className="navbar-link hide-mobile" onClick={close}>{t('nav.myRentals')}</Link>
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
          <div ref={langRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setLangOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t('language.choose')}
              style={{
                background: 'none', border: '1px solid rgba(242,240,235,0.2)',
                borderRadius: '3px', color: 'rgba(242,240,235,0.5)',
                fontSize: '11px', fontFamily: 'var(--font-mono)',
                padding: '5px 10px', cursor: 'pointer', letterSpacing: '0.08em',
                display: 'inline-flex', alignItems: 'center', gap: '5px',
              }}
            >
              {current.toUpperCase()}
              <span aria-hidden style={{ fontSize: '8px', opacity: 0.7 }}>▼</span>
            </button>

            {langOpen && (
              <ul
                role="listbox"
                aria-label={t('language.choose')}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                  margin: 0, padding: '4px', listStyle: 'none',
                  background: 'var(--ink, #121417)',
                  border: '1px solid rgba(242,240,235,0.2)', borderRadius: '4px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.35)', minWidth: '112px',
                }}
              >
                {LANGUAGES.map(l => (
                  <li key={l}>
                    <button
                      role="option"
                      aria-selected={l === current}
                      onClick={() => chooseLanguage(l)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                        background: 'none', border: 'none', cursor: 'pointer',
                        // Выбранный язык виден и без цвета: галочка остаётся
                        // при любой теме и читается тем, кто не различает
                        // оттенки серого на тёмном.
                        color: l === current ? 'rgba(242,240,235,0.95)' : 'rgba(242,240,235,0.6)',
                        fontSize: '12px', fontFamily: 'var(--font-mono)',
                        padding: '7px 10px', textAlign: 'left', borderRadius: '3px',
                      }}
                    >
                      <span aria-hidden style={{ width: '10px' }}>{l === current ? '✓' : ''}</span>
                      {t(`language.${l}`)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

/**
 * Страж закрытых страниц.
 *
 * Найдено 12.08 по жалобе «через „list a tool" попадаешь на логин, и
 * оттуда нет выхода, петля». Воспроизведено на проде:
 *
 *   лендинг                     история: 2
 *   нажал «Déposer un outil» →  /login, история: 4
 *   назад №1 → /login
 *   назад №2 → /login   ← и так до бесконечности
 *
 * Причина: `<Navigate to="/login" />` по умолчанию ДОБАВЛЯЕТ запись в
 * историю, а не заменяет. Получалось [/, /list-item, /login]; «назад»
 * возвращал на /list-item, страж срабатывал снова и снова толкал на
 * /login. Выбраться назад было нельзя вообще — только закрыть вкладку.
 *
 * Дверь стояла на главной кнопке лендинга, то есть ровно на той дороге,
 * ради которой лендинг и переписан под владельца инструмента.
 *
 * `replace` убирает промежуточную запись: история остаётся [/, /login],
 * и «назад» возвращает туда, откуда пришли. Заодно запоминаем, куда
 * человек шёл, чтобы после входа отправить его именно туда.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  // Приложение поднялось — значит прошлая поломка чанка вылечена
  // перезагрузкой. Снимаем флаг, иначе СЛЕДУЮЩИЙ сбой в этой же сессии
  // не получит своей попытки и человек упрётся в текст вместо того,
  // чтобы просто поехать дальше.
  useEffect(() => { clearChunkReloadFlag() }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <CookieBanner />
        {/* fallback={null} означал: пока страница грузится — пусто. То
            есть «грузится» и «сломалось» выглядели одинаково, и человек
            не мог отличить медленную сеть от мёртвой вкладки.
            RouteBoundary ловит непогрузившийся чанк (после деплоя старые
            имена файлов исчезают) и перезагружает страницу один раз. */}
        <RouteBoundary message={t('routeError')} retry={t('routeRetry')}>
        <Suspense fallback={<div className="loading">{t('common.loading')}</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/browse" element={<Home />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/list-item" element={<RequireAuth><ListItem /></RequireAuth>} />
            <Route path="/edit-item/:id" element={<RequireAuth><EditItem /></RequireAuth>} />
            <Route path="/my-items" element={<RequireAuth><MyItems /></RequireAuth>} />
            <Route path="/my-rentals" element={<RequireAuth><MyRentals /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/rental-shops" element={<RentalShops />} />
            {/* Отложено 11.08 вместе с переходом на бесплатную модель:
                /pro · /business · /business/dashboard · /pay/:bookingId
                Страницы целиком лежат в parked/ — там же как их оживить.
                В src/ их держать нельзя: страж утверждений даёт 14
                срабатываний на тарифах и страховке, и был бы прав.

                /rental-shops выше — не их замена: там нет тарифов, потому
                что тарифов нет в продукте. */}
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
        </RouteBoundary>
        {pathname !== '/' && (
          <footer style={{ textAlign: 'center', padding: 'var(--space-5) var(--space-4)', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
            {/* Была ссылка на /business, коммит 1409b3a снёс страницу и
                понизил её до <span>. Надпись, обращённая к прокатчикам,
                полгода никуда не вела. */}
            <Link to="/rental-shops" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              {t('forRentalShops')}
            </Link>
          </footer>
        )}
        <Toaster position="bottom-right" />
      </div>
    </QueryClientProvider>
  )
}