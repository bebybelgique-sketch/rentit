import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { t, getLang } from '../i18n'
import { translations } from '../i18n'

// Leaflet loaded via CDN in index.html — using window.L
declare const L: any

function MapView({ items, userPos }: { items: Item[], userPos: { lat: number; lng: number } | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || !window.L) return
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    const center = userPos ? [userPos.lat, userPos.lng] : [50.85, 4.35]
    const map = L.map(containerRef.current).setView(center, 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    items.filter(i => i.lat && i.lng).forEach(item => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#080808;color:#ADFF2F;font-family:monospace;font-size:12px;font-weight:600;padding:4px 9px;border-radius:3px;border:1px solid rgba(173,255,47,0.5);white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer">€${Number(item.price_per_day).toFixed(2)}</div>`,
        iconAnchor: [28, 14],
      })
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(map)
      const safePhotoUrl = item.photos?.[0]?.replace(/"/g, '') || ''
      const photo = safePhotoUrl ? `<img src="${safePhotoUrl}" alt="Photo of ${esc(item.title)}" style="width:100%;height:90px;object-fit:cover;border-radius:3px;margin-bottom:8px;display:block">` : ''
      marker.bindPopup(`
        <div style="min-width:180px;font-family:inherit">
          ${photo}
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(item.title)}</div>
          <div style="font-size:13px;color:#666;margin-bottom:10px">€${Number(item.price_per_day).toFixed(2)}/jour${item.deposit > 0 ? ` · €${Number(item.deposit).toFixed(2)} caution` : ''}</div>
          <a href="/item/${esc(item.id)}" style="display:block;background:#080808;color:#ADFF2F;padding:7px 12px;border-radius:3px;font-size:12px;font-weight:600;text-align:center;text-decoration:none">Voir l'outil →</a>
        </div>
      `)
    })

    return () => { map.remove(); mapRef.current = null }
  }, [items, userPos])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}

const CATEGORIES = [
  { value: '', label: 'Tous les outils' },
  { value: 'power_tools', label: '⚡ Électroportatif' },
  { value: 'hand_tools', label: '🔧 Outillage manuel' },
  { value: 'garden', label: '🌿 Jardinage' },
  { value: 'construction', label: '🏗️ Construction' },
  { value: 'cleaning', label: '🧹 Nettoyage' },
  { value: 'measuring', label: '📐 Mesure & Détection' },
]

const CONDITION_FR: Record<string, string> = {
  new: 'Neuf',
  like_new: 'Comme neuf',
  good: 'Bon état',
  fair: 'Correct',
}

const CATEGORY_EMOJI: Record<string, string> = {
  power_tools: '⚡', hand_tools: '🔧', garden: '🌿',
  construction: '🏗️', cleaning: '🧹', measuring: '📐',
}

interface Item {
  id: string
  title: string
  category: string
  price_per_day: number
  deposit: number
  photos: string[]
  lat: number | null
  lng: number | null
  address: string | null
  condition: string
  users: { full_name: string; rating_as_owner: number | null; is_pro: boolean }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ height: '180px' }} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ height: '11px', width: '60%' }} />
        <div className="skeleton" style={{ height: '16px', width: '85%' }} />
        <div className="skeleton" style={{ height: '22px', width: '40%' }} />
        <div className="skeleton" style={{ height: '11px', width: '55%' }} />
      </div>
    </div>
  )
}

export default function Home() {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState('')
  const [nearby, setNearby] = useState(false)
  const [radius, setRadius] = useState(10)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [maxPrice, setMaxPrice] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('items')
        .select('id, title, category, price_per_day, deposit, photos, lat, lng, address, condition, users!owner_id(full_name, rating_as_owner, is_pro)')
        .eq('available', true)
        .order('created_at', { ascending: false })

      if (category) query = query.eq('category', category)
      if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)
      if (maxPrice) query = query.lte('price_per_day', parseFloat(maxPrice))

      const { data, error } = await query
      if (error) throw error

      let result = (data || []) as unknown as Item[]

      if (nearby && userPos) {
        result = result.filter(item => {
          if (!item.lat || !item.lng) return false
          return haversineKm(userPos.lat, userPos.lng, item.lat, item.lng) <= radius
        })
      }

      // Занятость считает сервер: политики на bookings не пускают
      // постороннего к чужим броням, поэтому отфильтровать даты в
      // браузере нечем. Функция отдаёт только «эта вещь занята» — тот же
      // факт, что и календарь на странице вещи.
      if (startDate && endDate && endDate >= startDate) {
        const { data: busy, error: busyErr } = await supabase
          .rpc('items_busy_between', { p_start: startDate, p_end: endDate })
        // Ошибка запроса не должна молча превращаться в «всё свободно»:
        // лучше показать всё, чем показать занятое как доступное.
        if (busyErr) throw busyErr
        const busyIds = new Set((busy || []).map((r: { item_id: string }) => r.item_id))
        result = result.filter(item => !busyIds.has(item.id))
      }

      setItems(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, category, nearby, radius, userPos, maxPrice, startDate, endDate])

  useEffect(() => { fetchItems() }, [fetchItems])

  const toggleNearby = () => {
    if (!nearby && !userPos) {
      setGeoLoading(true)
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setNearby(true)
          setGeoLoading(false)
        },
        () => setGeoLoading(false)
      )
    } else {
      setNearby(prev => !prev)
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: '800', letterSpacing: '-0.03em', marginBottom: '6px', whiteSpace: 'pre-line' }}>
          {t('heroTitle')}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
          {t('heroSub')}
        </p>
      </div>

      {/* Search bar */}
      <div className="search-bar">
        <input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: '180px' }}
          aria-label={t('searchPlaceholder')}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label={t('category')}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input
          type="number"
          placeholder={t('maxPrice')}
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
          style={{ width: '110px', minWidth: '110px' }}
          aria-label={t('maxPrice')}
        />
        {/* Даты: без них витрина показывает уже занятый инструмент, и
            первое обращение человека заканчивается отказом. */}
        <input
          type="date"
          value={startDate}
          onChange={e => {
            const v = e.target.value
            setStartDate(v)
            // Конец раньше начала — следствие порядка ввода, а не выбора.
            if (endDate && endDate < v) setEndDate(v)
          }}
          style={{ width: '150px', minWidth: '150px' }}
          aria-label="Disponible du"
          title="Disponible du"
        />
        <input
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={e => setEndDate(e.target.value)}
          style={{ width: '150px', minWidth: '150px' }}
          aria-label="Disponible au"
          title="Disponible au"
        />
        <button
          onClick={toggleNearby}
          className={`btn ${nearby ? 'btn-accent' : 'btn-secondary'}`}
          disabled={geoLoading}
          style={{ whiteSpace: 'nowrap', minHeight: '44px' }}
        >
          {geoLoading ? '...' : t('nearby')}
        </button>
        {nearby && (
          <select
            value={radius}
            onChange={e => setRadius(parseInt(e.target.value))}
            style={{ width: '90px', minWidth: '90px' }}
            aria-label={t('searchRadius')}
          >
            {[2, 5, 10, 20, 50].map(r => <option key={r} value={r}>{r} km</option>)}
          </select>
        )}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button
          onClick={() => setViewMode('grid')}
          className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="0" y="0" width="6" height="6" rx="1" fill="currentColor"/>
            <rect x="8" y="0" width="6" height="6" rx="1" fill="currentColor"/>
            <rect x="0" y="8" width="6" height="6" rx="1" fill="currentColor"/>
            <rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor"/>
          </svg>
          Grille
        </button>
        <button
          onClick={() => setViewMode('map')}
          className={`btn ${viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1C4.79 1 3 2.79 3 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <circle cx="7" cy="5" r="1.5" fill="currentColor"/>
          </svg>
          Carte
        </button>
      </div>

      {/* Category chips */}
      <div className="chips-row">
        {CATEGORIES.slice(1).map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(category === c.value ? '' : c.value)}
            className={`chip ${category === c.value ? 'active' : ''}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Map view */}
      {viewMode === 'map' && !loading && (
        <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '24px', height: '40vh', minHeight: '280px' }}>
          <MapView items={items} userPos={userPos} />
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '64px 32px', textAlign: 'center', background: '#fff',
        }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔨</div>
          <h3 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '10px' }}>
            {t('noResultsTitle')}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '6px' }}>
            {t('noResultsDesc')}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--font-mono)', marginBottom: '28px' }}>
            {t('earlyLister')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/list-item" className="btn btn-primary" style={{ minHeight: '44px' }}>
              {t('listFirstTool')}
            </Link>
            {radius < 50 && (
              <button
                onClick={() => { setRadius(50); if (!nearby) toggleNearby() }}
                className="btn btn-secondary"
                style={{ minHeight: '44px' }}
              >
                {t('expandSearch')}
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'map' ? null : (
        <>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '16px',
          }}>
            {getLang() === 'en' ? translations.en.toolsAvailable(items.length) : translations.fr.toolsAvailable(items.length)}
          </div>
          <div className="grid grid-3">
            {items.map(item => (
              <Link key={item.id} to={`/item/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="item-card">
                  {item.photos && item.photos.length > 0 ? (
                    <img
                      src={item.photos[0]}
                      alt={item.title}
                      className="item-card-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="item-card-img">
                      {CATEGORY_EMOJI[item.category] || '📦'}
                    </div>
                  )}
                  <div className="item-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <span className="tag tag-gray">
                        {t(`categories.${item.category}`) || `${CATEGORY_EMOJI[item.category]} ${item.category}`}
                      </span>
                      <span className="tag tag-gray">
                        {CONDITION_FR[item.condition] || item.condition}
                      </span>
                    </div>
                    <div className="item-card-title">{item.title}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                      <span className="item-card-price">€{item.price_per_day.toFixed(2)}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>/jour</span>
                    </div>
                    {item.deposit > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        + €{item.deposit.toFixed(2)} caution
                      </div>
                    )}
                    <div className="item-card-meta">
                      {item.address && `📍 ${item.address}`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                      {(item.users as any)?.rating_as_owner ? (
                        <span className="rating" style={{ fontSize: '12px' }}>
                          ★ {Number((item.users as any).rating_as_owner).toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                          {t('newOwner')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
