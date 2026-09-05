import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAdminAction } from '../hooks/mutations/useAdminAction'
import { serverErrorKey } from '../domain/serverErrors'

// Действия над ЧУЖИМИ строками идут через edge-функцию admin-action.
//
// Прямой `supabase.from(...).update(...)` отсюда убран не ради стиля: он
// не работал. Грант на UPDATE у роли authenticated выдан поимённо на шесть
// столбцов профиля (миграция 20260812000017), роли в списке нет; политика
// на items разрешает менять только СВОИ объявления. То есть «Make admin» и
// «Hide» на чужой вещи молча не делали ничего, а страница при этом
// перекрашивала бейдж — и он возвращался после перезагрузки.
//
// Чтение списков остаётся прямым: политика «Public user names/ratings
// visible» и «Items are public» разрешают SELECT всем, а колоночные гранты
// уже прячут phone_otp и прочее служебное. Заводить ради этого серверные
// list_*-действия значило бы дублировать RLS в коде функции.

export default function Admin() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const adminAction = useAdminAction()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'stats' | 'items' | 'users'>('stats')
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  const [stats, setStats] = useState({ users: 0, items: 0, bookings: 0, revenue: 0 })
  const [items, setItems] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adminError, setAdminError] = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    supabase.from('users').select('role').eq('id', user.id).single().then(({ data }) => {
      if (data?.role !== 'admin') { navigate('/'); return }
      setAuthorized(true)
      fetchAll()
    })
  }, [user])

  // ИЗВЕСТНАЯ ЛОЖЬ НА ЭКРАНЕ, не закрытая этим заходом: счётчики ниже
  // считаются под правами самого администратора, а RLS на bookings и
  // payments показывает человеку только ЕГО строки. Значит «Bookings» и
  // «Revenue» на вкладке Stats — это цифры одного пользователя, а не
  // площадки, и выглядят они при этом как общие. Чинится либо действием
  // `get_stats` в admin-action (служебный ключ), либо SECURITY DEFINER
  // функцией со счётчиками. Отдельная задача: здесь править нечего, кроме
  // источника данных.
  const fetchAll = async () => {
    const [
      { count: uCount },
      { count: iCount },
      { count: bCount },
      { data: payData },
      { data: itemData },
      { data: userData },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('platform_fee').eq('status', 'succeeded'),
      supabase.from('items').select('*, users!owner_id(full_name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('users').select('id, full_name, role, created_at, phone_verified').order('created_at', { ascending: false }).limit(100),
    ])
    const revenue = (payData || []).reduce((s: number, p: any) => s + (p.platform_fee || 0), 0)
    setStats({ users: uCount || 0, items: iCount || 0, bookings: bCount || 0, revenue: revenue / 100 })
    setItems(itemData || [])
    setUsers(userData || [])
    setLoading(false)
  }

  // Отказ приходит кодом ('forbidden', 'cannot_demote_self'), текст
  // подбирает словарь: src/domain/serverErrors.ts.
  const showError = (error: unknown) => {
    setAdminError(t(serverErrorKey(error instanceof Error ? error.message : null)))
  }

  const toggleItem = async (id: string, available: boolean) => {
    setAdminError('')
    try {
      const res = await adminAction.mutateAsync({ type: 'set_item_available', item_id: id, available: !available })
      // Показываем состояние, ПРИШЕДШЕЕ из базы, а не то, которое
      // собирались получить: иначе экран снова расходится с базой.
      const next = res.item?.available ?? !available
      setItems(p => p.map(i => i.id === id ? { ...i, available: next } : i))
    } catch (error) {
      showError(error)
    }
  }

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    const role = isAdmin ? 'user' : 'admin'
    const name = users.find(u => u.id === id)?.full_name || id
    const msg = isAdmin ? t('admin.confirmRevoke', { name }) : t('admin.confirmGrant', { name })
    if (!confirm(msg)) return
    setAdminError('')
    try {
      const res = await adminAction.mutateAsync({ type: 'set_user_role', user_id: id, role })
      const next = res.user?.role ?? role
      setUsers(p => p.map(u => u.id === id ? { ...u, role: next } : u))
    } catch (error) {
      showError(error)
    }
  }

  if (authorized === null || loading) return <div className="page"><div className="loading">{t('common.loading')}</div></div>

  return (
    <div className="page">
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '800' }}>Admin</h1>
      {adminError && <div className="error-msg" style={{ marginBottom: '16px' }}>{adminError}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Stats</button>
        <button className={`tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>Items</button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
      </div>

      {tab === 'stats' && (
        <div className="grid grid-2">
          {[
            { label: 'Users', value: stats.users, emoji: '👥' },
            { label: 'Listings', value: stats.items, emoji: '📦' },
            { label: 'Bookings', value: stats.bookings, emoji: '📅' },
            { label: 'Revenue (platform fee)', value: `€${stats.revenue.toFixed(2)}`, emoji: '💰' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>{s.emoji}</div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary)' }}>{s.value}</div>
              <div style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong>{item.title}</strong>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    by {item.users?.full_name} · €{item.price_per_day}/day · {item.category}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`tag ${item.available ? 'tag-green' : 'tag-gray'}`}>
                    {item.available ? 'Active' : 'Hidden'}
                  </span>
                  <button
                    onClick={() => toggleItem(item.id, item.available)}
                    className="btn btn-secondary btn-sm"
                  >
                    {item.available ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {users.map(u => (
            <div key={u.id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong>{u.full_name || '(no name)'}</strong>
                  {u.phone_verified && <span className="tag tag-green" style={{ marginLeft: '8px', fontSize: '11px' }}>✓ Phone</span>}
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`tag ${u.role === 'admin' ? 'tag-purple' : 'tag-gray'}`}>
                    {u.role}
                  </span>
                  {u.id !== user?.id && (
                    <button
                      onClick={() => toggleAdmin(u.id, u.role === 'admin')}
                      className="btn btn-secondary btn-sm"
                    >
                      {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
