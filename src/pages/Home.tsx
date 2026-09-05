import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
import {
  CATEGORIES, categoryLabelKey, conditionLabelKey, isCategoryValue,
} from '../domain/catalog'
import CategoryIcon from '../components/icons/CategoryIcon'

// Leaflet берётся из зависимостей проекта, а не с unpkg.
//
// Раньше в <head> index.html висели <script> и <link> на unpkg.com, и
// грузились они на КАЖДОЙ странице — на входе, на лендинге, в условиях,
// где карты нет вовсе. Два чужих запроса в критическом пути ради экрана,
// который открывает меньшинство.
//
// Пакет `leaflet` при этом уже лежал в package.json и не импортировался
// ни разу: карта работала на глобальном `window.L`. Теперь он приезжает
// вместе с кодом витрины — Vite отдаёт его отдельным куском, и на других
// страницах он не грузится совсем.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function MapView({ items, userPos }: { items: Item[], userPos: { lat: number; lng: number } | null }) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    // Проверка на window.L снята: L теперь импорт, а не глобальная
    // переменная, которая могла не доехать с чужого CDN.
    if (!containerRef.current) return
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    const center: [number, number] = userPos ? [userPos.lat, userPos.lng] : [50.85, 4.35]
    const map = L.map(containerRef.current).setView(center, 13)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    // Предикат, а не просто фильтр: без него TypeScript не сужает
    // number | null и ругается на L.marker. Проверка та же самая,
    // просто теперь она видна и типам.
    const placed = items.filter(
      (i): i is Item & { lat: number; lng: number } => i.lat != null && i.lng != null
    )

    placed.forEach(item => {
      const icon = L.divIcon({
        className: '',
        // Метка была лаймовой (#ADFF2F на #080808) — старая палитра,
        // пережившая смену токенов, потому что живёт внутри строки и под
        // замену переменных не попала. Цена не действие и не сигнал,
        // поэтому здесь чернила, белый текст и серебряная кромка, а не
        // красный с жёлтым.
        html: `<div style="background:#121417;color:#F0F1F3;font-family:'Source Sans 3',system-ui,sans-serif;font-size:12px;font-weight:600;padding:4px 9px;border-radius:6px;border:1px solid rgba(198,205,213,0.45);white-space:nowrap;box-shadow:0 2px 8px rgba(18,20,23,0.45);cursor:pointer">€${Number(item.price_per_day).toFixed(2)}</div>`,
        iconAnchor: [28, 14],
      })
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(map)
      const safePhotoUrl = item.photos?.[0]?.replace(/"/g, '') || ''
      const photo = safePhotoUrl ? `<img src="${safePhotoUrl}" alt="${t('home.altText', { title: esc(item.title) })}" style="width:100%;height:90px;object-fit:cover;border-radius:3px;margin-bottom:8px;display:block">` : ''
      marker.bindPopup(`
        <div style="min-width:180px;font-family:inherit">
          ${photo}
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(item.title)}</div>
          <div style="font-size:13px;color:#666;margin-bottom:10px">€${Number(item.price_per_day).toFixed(2)}${t('home.perDay')}${item.deposit > 0 ? ` · €${Number(item.deposit).toFixed(2)} caution` : ''}</div>
          <a href="/item/${esc(item.id)}" style="display:block;background:#080808;color:#ADFF2F;padding:7px 12px;border-radius:3px;font-size:12px;font-weight:600;text-align:center;text-decoration:none">${t('home.seeMore')}</a>
        </div>
      `)
    })

    return () => { map.remove(); mapRef.current = null }
  }, [items, userPos, t])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}

// Категории, состояния и эмодзи больше не объявляются здесь: они живут в
// src/domain/catalog.ts. Прежняя копия разошлась с копией на странице вещи
// (⚡ против 🔌 для одной и той же категории).

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
  /** Метры от точки посетителя. Считает база; null, если точки нет. */
  distance_m: number | null
}

/** Строка, как её отдаёт функция browse_items. */
type BrowseRow = {
  id: string
  title: string
  category: string
  price_per_day: number
  deposit: number
  photos: string[] | null
  lat: number | null
  lng: number | null
  address: string | null
  condition: string
  owner_id: string
  owner_full_name: string | null
  owner_rating: number | null
  owner_is_pro: boolean | null
  distance_m: number | null
}

/**
 * Расстояние в том виде, в каком его читает человек: до километра — в метрах
 * с шагом 50, дальше — километры. «0.8 km» и «1.24 km» одинаково неудобны,
 * когда решаешь, дойти пешком или ехать.
 */
function formatDistance(km: number): string {
  if (km < 1) return `à ${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`
  if (km < 10) return `à ${km.toFixed(1).replace('.', ',')} km`
  return `à ${Math.round(km)} km`
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
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  // Лендинг клал в адрес ?where=..., а витрина его не читала — поле на
  // первом экране выглядело рабочим и молча ничего не делало. Фальшивый
  // интерактив хуже отсутствующего: человек считает, что отфильтровал.
  const [place, setPlace] = useState(searchParams.get('where') ?? '')
  // Лендинг вёл на /browse?category=power_tools шестью плитками, а витрина
  // этот параметр НЕ читала: человек нажимал «Électroportatif», попадал на
  // общий список и не понимал, почему фильтр не сработал. Тот же класс, что
  // был с ?where= (комментарий ниже) — только его починили, а этот остался.
  //
  // Значение сверяется с каталогом: чужое `?category=logement` иначе
  // отфильтровало бы витрину в ноль и выглядело как «ничего нет».
  const [category, setCategory] = useState(() => {
    const fromUrl = searchParams.get('category')
    return isCategoryValue(fromUrl) ? fromUrl : ''
  })
  const [nearby, setNearby] = useState(false)
  // Отказ геолокации: показывается рядом с кнопкой, а не в консоли.
  const [geoError, setGeoError] = useState('')
  const [radius, setRadius] = useState(10)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [maxPrice, setMaxPrice] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Сколько второстепенных фильтров применено. Свёрнутая панель не должна
  // прятать работающий отбор: иначе человек видит две вещи вместо двадцати и
  // считает, что на площадке пусто. Число на кнопке — и есть это признание.
  const extraFilterCount =
    (maxPrice ? 1 : 0) + (place.trim() ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)

  // Пришли с лендинга с ?where=… — фильтр уже действует, значит панель
  // открывается сразу, а не прячет причину сокращённой выдачи.
  useEffect(() => {
    if (extraFilterCount > 0) setFiltersOpen(true)
    // Только на первом рендере: дальше панелью управляет человек.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      // Всю выборку делает база одной функцией: радиус по GiST-индексу,
      // категория, цена, текст, место и занятость на выбранные даты.
      //
      // Раньше браузер забирал все подходящие вещи и отсеивал их по радиусу
      // сам. На пустой витрине разницы не видно, но чинить это надо до
      // наплыва: под нагрузкой переписывать фильтр — худший момент.
      //
      // Точку передаём всегда, когда она известна, а радиус — только когда
      // включена близость. Так расстояние приходит и для показа на карточке,
      // а отбор по радиусу остаётся отдельным решением человека.
      const { data, error } = await supabase.rpc('browse_items', {
        p_lat: userPos?.lat,
        p_lng: userPos?.lng,
        p_radius_km: nearby && userPos ? radius : undefined,
        p_category: category || undefined,
        p_search: search.trim() || undefined,
        p_max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        p_place: place.trim() || undefined,
        p_start: startDate && endDate && endDate >= startDate ? startDate : undefined,
        p_end: startDate && endDate && endDate >= startDate ? endDate : undefined,
      } as Record<string, unknown>)
      if (error) throw error

      // Форма карточки не меняется: владелец собирается обратно в users.
      const result: Item[] = ((data || []) as BrowseRow[]).map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        price_per_day: Number(row.price_per_day),
        deposit: Number(row.deposit),
        photos: row.photos ?? [],
        lat: row.lat,
        lng: row.lng,
        address: row.address,
        condition: row.condition,
        users: {
          full_name: row.owner_full_name ?? '',
          rating_as_owner: row.owner_rating,
          is_pro: row.owner_is_pro ?? false,
        },
        distance_m: row.distance_m,
      }))

      setItems(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, category, nearby, radius, userPos, maxPrice, startDate, endDate, place])

  useEffect(() => { fetchItems() }, [fetchItems])

  const toggleNearby = () => {
    if (!nearby && !userPos) {
      // Отказ браузера ОБЯЗАН быть сказан вслух.
      //
      // Здесь стояло `() => setGeoLoading(false)`: кнопка мигала «...» и
      // возвращалась как была — ни сообщения, ни следа. А отказ обычный:
      // разрешение не дано, прежний отказ запомнен, службы местоположения
      // выключены в системе. Снаружи всё это выглядит как «кнопка не
      // работает», и человеку неоткуда узнать, что решение принял его
      // браузер, а не продукт.
      //
      // В форме выкладки тот же вызов сделан правильно с 12.08
      // (ListItem.tsx, listItem.geolocationDenied + таймаут) — два
      // обработчика одного и того же разошлись молча.
      //
      // Таймаут обязателен по второй причине: без него getCurrentPosition
      // на части устройств не отвечает вовсе, и кнопка остаётся навсегда
      // отключённой с надписью «...».
      if (!navigator.geolocation) {
        setGeoError(t('nearbyUnavailable'))
        return
      }
      setGeoLoading(true)
      setGeoError('')
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setNearby(true)
          setGeoLoading(false)
        },
        () => {
          setGeoLoading(false)
          setGeoError(t('nearbyUnavailable'))
        },
        { timeout: 10000 },
      )
    } else {
      setNearby(prev => !prev)
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4vw, var(--text-xl))', fontWeight: '800', letterSpacing: '-0.03em', marginBottom: 'var(--space-2)', whiteSpace: 'pre-line' }}>
          {t('heroTitle')}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-base)' }}>
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
        {/* Селект категорий убран: тот же выбор делают чипы ниже, и делают
            его виднее. Два органа для одного фильтра — это не запасной путь,
            а вопрос «а эти два одно и то же?» на каждом визите. Сброс не
            потерян: повторное нажатие по чипу снимает выбор. */}
        <button
          onClick={toggleNearby}
          className={`btn ${nearby ? 'btn-accent' : 'btn-secondary'}`}
          disabled={geoLoading}
          style={{ whiteSpace: 'nowrap', minHeight: '44px' }}
        >
          {geoLoading ? '...' : t('nearby')}
        </button>
        {/* Цена, место и даты нужны меньшинству и реже, но занимали весь
            первый экран телефона: семь полей подряд и ни одного инструмента.
            Витрина обязана показывать инструменты, а не форму. */}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className="btn btn-secondary"
          style={{ whiteSpace: 'nowrap', minHeight: '44px' }}
          aria-expanded={filtersOpen}
        >
          Filtres{extraFilterCount > 0 ? ` · ${extraFilterCount}` : ''} {filtersOpen ? '▴' : '▾'}
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

      {/* Отказ показываем ПОД строкой поиска, а не внутри неё: строка —
          flex-ряд, и абзац в нём разъезжается на телефоне. role="status",
          чтобы диктор прочитал появившееся сообщение: без него отказ
          остаётся невидимым ровно для того, кто не увидит и кнопку. */}
      {geoError && (
        <p role="status" style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          {geoError}
        </p>
      )}

      {filtersOpen && (
        <div className="filters-panel">
          <label className="filters-field">
            <span>{t('home.maxPriceLabel')}</span>
            <input
              type="number"
              placeholder={t('maxPrice')}
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
            />
          </label>
          <label className="filters-field">
            <span>{t('home.locationLabel')}</span>
            <input
              type="text"
              placeholder={t('home.locationPlaceholder')}
              value={place}
              onChange={e => setPlace(e.target.value)}
            />
          </label>
          {/* Два одинаковых dd.mm.yyyy подряд не читаются как диапазон:
              человек видит два поля даты и не знает, какое «с», а какое «по».
              Подписи здесь несут смысл, а не украшают. */}
          <label className="filters-field">
            <span>{t('home.availableFrom')}</span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                const v = e.target.value
                setStartDate(v)
                // Конец раньше начала — следствие порядка ввода, а не выбора.
                if (endDate && endDate < v) setEndDate(v)
              }}
            />
          </label>
          <label className="filters-field">
            <span>{t('home.availableTo')}</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
          {extraFilterCount > 0 && (
            <button
              onClick={() => { setMaxPrice(''); setPlace(''); setStartDate(''); setEndDate('') }}
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'end' }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Переключатель вида.
          Активное состояние красили `btn-primary`, то есть `var(--action)` —
          цветом, который в палитре отдан ДЕЙСТВИЮ и только ему. На витрине
          это ставило «Grille» вровень с «Déposer votre premier outil»: два
          красных пятна, из которых одно вообще ничего не делает. Красный —
          глагол; выбранный режим — не глагол, а состояние, и красится
          чернилами.
          Подписи заодно уехали в словари: они были захардкожены
          по-французски, а храповик их не видит — текст стоял отдельной
          строкой между тегами, это его известная слепая зона. */}
      <div className="seg" role="group" aria-label={t('home.viewLabel')}>
        <button
          type="button"
          onClick={() => setViewMode('grid')}
          className={`seg-btn${viewMode === 'grid' ? ' is-on' : ''}`}
          aria-pressed={viewMode === 'grid'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="0" y="0" width="6" height="6" rx="1" fill="currentColor"/>
            <rect x="8" y="0" width="6" height="6" rx="1" fill="currentColor"/>
            <rect x="0" y="8" width="6" height="6" rx="1" fill="currentColor"/>
            <rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor"/>
          </svg>
          {t('home.viewGrid')}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={`seg-btn${viewMode === 'map' ? ' is-on' : ''}`}
          aria-pressed={viewMode === 'map'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1C4.79 1 3 2.79 3 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <circle cx="7" cy="5" r="1.5" fill="currentColor"/>
          </svg>
          {t('home.viewMap')}
        </button>
      </div>

      {/* Category chips */}
      <div className="chips-row">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(category === c.value ? '' : c.value)}
            className={`chip ${category === c.value ? 'active' : ''}`}
          >
            {t(c.labelKey)}
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
          padding: 'var(--space-8) var(--space-6)', textAlign: 'center', background: '#fff',
        }}>
          <div style={{ fontSize: '52px', marginBottom: 'var(--space-4)' }}>🔨</div>
          {/* Ступень --text-xl (28px) верна для десктопа, но на 390px этот
              заголовок ломается на три строки. Кегль тут обязан быть гибким:
              нижняя граница — --text-lg, верхняя — --text-xl. */}
          <h3 style={{ fontSize: 'clamp(var(--text-lg), 5vw, var(--text-xl))', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: 'var(--space-3)' }}>
            {t('noResultsTitle')}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
            {t('noResultsDesc')}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-6)' }}>
            {t('earlyLister')}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
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
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 'var(--space-4)',
          }}>
            {t('toolsAvailable', { count: items.length })}
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
                      <CategoryIcon category={item.category} size={56} />
                    </div>
                  )}
                  <div className="item-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <span className="tag tag-gray">
                        {t(categoryLabelKey(item.category) ?? '') || item.category}
                      </span>
                      <span className="tag tag-gray">
                        {t(conditionLabelKey(item.condition) ?? '') || item.condition}
                      </span>
                    </div>
                    <div className="item-card-title">{item.title}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                      <span className="item-card-price">€{item.price_per_day.toFixed(2)}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{t('home.perDay')}</span>
                    </div>
                    {item.deposit > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        + €{item.deposit.toFixed(2)} caution
                      </div>
                    )}
                    <div className="item-card-meta">
                      {item.address && `📍 ${item.address}`}
                    </div>
                    {/* Расстояние уже посчитано для фильтра по радиусу, но до
                        сих пор не доходило до экрана. Близость — главное
                        обещание витрины («Les outils de votre voisin»), и
                        человеку важно видеть, идти ему 800 м или 12 км. */}
                    {item.distance_m != null && (
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11px',
                        color: 'var(--muted)', marginTop: '4px',
                      }}>
                        {formatDistance(item.distance_m / 1000)}
                      </div>
                    )}
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
