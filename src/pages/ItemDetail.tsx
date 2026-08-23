import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { categoryLabelKey, conditionLabelKey } from '../domain/catalog'
import CategoryIcon from '../components/icons/CategoryIcon'
import { computeRentalPrice } from '../domain/pricing'
import {
  loadItemCalendar, toISODate, daysBetween, firstUnavailableDay, isTooSoon, isSelectable,
} from '../domain/availability'
import type { ItemCalendar } from '../domain/availability'

// Здесь лежали три собственные карты. Одна из них разошлась с витриной:
// power_tools был 🔌, а на витрине ⚡ — одна и та же категория с двумя
// значками на соседних экранах. Теперь источник один.

// Страхового сбора нет и не планируется: платформа не сторона договора и
// ничего не покрывает. Ноль оставлен, потому что колонка insurance_amount
// живёт в bookings с марта; комментарий «станет €3 после 50 сделок» снят —
// он описывал модель, от которой отказались.
const INSURANCE_PER_DAY = 0

interface Item {
  id: string
  owner_id: string
  title: string
  description: string | null
  category: string
  condition: string
  price_per_day: number
  price_3days: number | null
  price_week: number | null
  late_fee_per_day: number | null
  // Доставка. Непустая цена — единственный признак того, что услуга есть:
  // пусто, и вторая сторона не видит про доставку ни строчки.
  delivery_fee: number | null
  delivery_radius_km: number | null
  deposit: number
  photos: string[]
  lat: number | null
  lng: number | null
  address: string | null
  available: boolean
  // Сколько одинаковых единиц. Прокатчик с двенадцатью стульями не станет
  // заводить двенадцать объявлений — без этого поля он просто не заходит.
  quantity: number
  users: {
    id: string
    full_name: string
    avatar_url: string | null
    phone_verified: boolean
    rating_as_owner: number | null
    is_pro: boolean
  } | null
}

// История вещи: сколько раз её уже брали и когда в последний раз. Считает
// база (`item_history`, миграция 20260817000023) — политики на bookings
// постороннему чужих броней не показывают, а доверие строится из данных,
// которые УЖЕ есть: отзыв человек пишет редко, а факт сдачи лежит сам.
interface ItemHistory { times_rented: number; last_rented: string | null }

// Здесь жила функция `isBooked(date, ranges)` — пятое место в продукте,
// где даты пересекались руками, и единственное в браузере. С появлением
// количества единиц она стала прямо неверной: «бронь пересекается» больше
// не значит «занято», потому что у вещи может быть три одинаковых единицы.
//
// Теперь занятость считает база (`unavailable_days`, миграция
// 20260817000022), а страница получает готовый список дней. Календарь
// ничего не выводит — он только рисует.

export default function ItemDetail() {
  const { t, i18n } = useTranslation()
  const { id: itemId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()

  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [calendar, setCalendar] = useState<ItemCalendar | null>(null)
  const [history, setHistory] = useState<ItemHistory | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  // 'copied' | 'failed' | null. Булево здесь врало: запись в буфер могла не
  // состояться, а надпись «Lien copié» показывалась всё равно.
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })

  const [requestMessage, setRequestMessage] = useState('')
  // Доставку арендатор выбирает сам, и по умолчанию она не выбрана: молча
  // добавленная в счёт услуга — это сумма, о которой человек узнаёт при
  // встрече.
  const [wantsDelivery, setWantsDelivery] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [error, setError] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  const [reviews, setReviews] = useState<any[]>([])
  const [canReview, setCanReview] = useState(false)
  const [reviewStars, setReviewStars] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => { if (itemId) fetchItem() }, [itemId])

  const fetchItem = async () => {
    try {
      const [{ data: itemData }, calendarData, { data: reviewData }, { data: historyData }] = await Promise.all([
        supabase
          .from('items')
          .select('*, users!owner_id(id, full_name, avatar_url, phone_verified, rating_as_owner, is_pro)')
          .eq('id', itemId!)
          .single(),
        // Один вызов вместо прежнего get_booked_dates: недоступные дни,
        // самый ранний старт и количество единиц приходят вместе.
        loadItemCalendar(itemId!),
        supabase
          .from('reviews')
          .select('*, users!from_user_id(full_name, avatar_url)')
          .eq('item_id', itemId!)
          .eq('review_type', 'item')
          .order('created_at', { ascending: false }),
        supabase.rpc('item_history', { p_item_id: itemId }),
      ])
      if (itemData) setItem(itemData as unknown as Item)
      setCalendar(calendarData)
      setReviews(reviewData || [])
      setHistory((historyData as ItemHistory) ?? null)
      if (user && itemData) checkCanReview(itemData.id, itemData.owner_id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const checkCanReview = async (iId: string, ownerId: string) => {
    if (!user || user.id === ownerId) return
    const [{ data: booking }, { data: existing }] = await Promise.all([
      supabase.from('bookings').select('id').eq('item_id', iId).eq('renter_id', user.id).eq('status', 'completed').maybeSingle(),
      supabase.from('reviews').select('id').eq('item_id', iId).eq('from_user_id', user.id).eq('review_type', 'item').maybeSingle(),
    ])
    setCanReview(!!booking && !existing)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      // Отказ здесь — почти всегда «человек передумал», а не сбой: системное
      // окно закрыли. Молчать тут правильно, сообщать не о чем.
      await navigator.share({ title: item?.title || 'RentIt', url }).catch(() => {})
      return
    }

    // А здесь молчать было НЕЛЬЗЯ. Стояло:
    //   await navigator.clipboard.writeText(url).catch(() => {})
    //   setShared(true)
    // — то есть надпись «Lien copié» показывалась ВСЕГДА, в том числе когда
    // запись в буфер не состоялась: доступ к буферу закрыт настройкой,
    // страница открыта не по HTTPS, самого navigator.clipboard нет в этом
    // браузере (тогда прежний код и вовсе падал на обращении к writeText, и
    // кнопка выглядела мёртвой). Человек уходил делиться пустотой.
    const copied = navigator.clipboard
      ? await navigator.clipboard.writeText(url).then(() => true).catch(() => false)
      : false
    setShared(copied ? 'copied' : 'failed')
    setTimeout(() => setShared(null), 2500)
  }

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const todayISO = toISODate(new Date())

  const handleDayClick = (day: number) => {
    const ds = toISODate(new Date(calMonth.year, calMonth.month, day))
    if (!calendar || !isSelectable(calendar, ds, todayISO)) return
    if (!startDate || (startDate && endDate)) {
      setStartDate(ds); setEndDate('')
    } else if (ds < startDate) {
      setStartDate(ds); setEndDate('')
    } else {
      // Внутри выбранного отрезка не должно быть недоступных дней. Проверку
      // делает общий модуль — здесь её больше нет.
      if (firstUnavailableDay(calendar, startDate, ds)) { setStartDate(ds); setEndDate('') }
      else setEndDate(ds)
    }
  }

  const totalDays = startDate && endDate ? daysBetween(startDate, endDate).length : 0

  const insuranceFee = totalDays > 0 ? INSURANCE_PER_DAY * totalDays : 0
  // Ту же формулу применяет `request-rental`, когда пишет сумму в бронь —
  // файл общий (`supabase/functions/_shared/pricing.ts`). Считать здесь
  // «примерно так же» нельзя: человек увидел бы одну сумму, а в брони
  // оказалась бы другая, и разошлись бы они уже при встрече.
  const rental = item
    ? computeRentalPrice(
        { pricePerDay: item.price_per_day, price3Days: item.price_3days, priceWeek: item.price_week },
        totalDays,
      )
    : { total: 0, weeks: 0, packs3: 0, days: 0 }
  // Доставка — отдельная услуга владельца, а не часть аренды: в
  // bookings.total_price она не входит (там цена по тарифам, её считает
  // сервер), но в то, что арендатор отдаст при встрече, — входит.
  const deliveryFee = item && wantsDelivery && item.delivery_fee != null ? Number(item.delivery_fee) : 0
  const totalPrice = totalDays > 0 && item ? rental.total + item.deposit + insuranceFee + deliveryFee : 0
  const hasTiers = !!item && (!!item.price_3days || !!item.price_week)
  // Экономия против дневной цены. Показываем, только если она есть: иначе
  // строка «вы экономите 0 €» превращается в насмешку.
  const savedVsDaily = item && totalDays > 0
    ? Math.round((item.price_per_day * totalDays - rental.total) * 100) / 100
    : 0

  const handleRequest = async () => {
    if (!user || !item || !startDate || !endDate) return
    try {
      setRequestLoading(true); setError('')
      const res = await supabase.functions.invoke('request-rental', {
        // Цену доставки НЕ передаём — только сам выбор. Сумму сервер берёт
        // из вещи и кладёт в бронь снимком: доверять числу из браузера
        // здесь так же нельзя, как и в total_price.
        body: { item_id: item.id, start_date: startDate, end_date: endDate, message: requestMessage.trim() || null, delivery_requested: wantsDelivery },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      if (res.error) throw res.error
      setRequestSent(true)
    } catch (err: any) {
      setError(err.message || t('itemDetail.requestError'))
    } finally {
      setRequestLoading(false)
    }
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !item) return
    setReviewLoading(true)
    try {
      const { data: booking } = await supabase
        .from('bookings').select('id').eq('item_id', item.id).eq('renter_id', user.id)
        .eq('status', 'completed').maybeSingle()
      if (!booking) return
      const { error } = await supabase.from('reviews').insert([{
        booking_id: booking.id,
        from_user_id: user.id,
        to_user_id: item.owner_id,
        item_id: item.id,
        review_type: 'item',
        rating: reviewStars,
        comment: reviewComment.trim() || null,
      }])
      if (error) throw error
      setReviewSuccess(true); setCanReview(false)
      fetchItem()
    } catch (err) {
      console.error(err)
    } finally {
      setReviewLoading(false)
    }
  }

  if (loading) return <div className="page"><div className="loading">{t('common.loading')}</div></div>
  // Раньше здесь была голая надпись «Outil introuvable» без единой
  // кнопки: человек по ссылке на снятое объявление попадал в тупик и мог
  // только нажать «назад» — а если пришёл по прямой ссылке, то и назад
  // было некуда. При пустой витрине такая ссылка — обычное дело.
  if (!item) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 'var(--space-8)' }}>
      <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
        {t('itemGone')}
      </p>
      <p style={{ color: 'var(--muted)', marginBottom: 'var(--space-6)' }}>{t('itemGoneHint')}</p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/browse" className="btn btn-primary" style={{ minHeight: '48px' }}>{t('browse')}</Link>
        <Link to="/" className="btn btn-secondary" style={{ minHeight: '48px' }}>{t('backHome')}</Link>
      </div>
    </div>
  )

  const photos = item.photos || []
  const { year, month } = calMonth
  const daysCount = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null

  return (
    <div className="page">
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', color: 'var(--text)', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
          >
            ← Retour
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleShare}
              style={{ background: 'none', color: 'var(--text)', fontSize: '13px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s' }}
            >
              {shared === 'copied' ? t('share.linkCopied')
                : shared === 'failed' ? t('share.copyFailed')
                : t('share.copyLink')}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                // «/jour sur RentIt» было по-французски для всех: голландец
                // делился ссылкой с французским хвостом.
                `${t('share.whatsappText', { title: item.title, price: item.price_per_day })}\n${window.location.href}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#25D366', color: '#fff',
                fontSize: '13px', fontWeight: '600',
                border: 'none', borderRadius: 'var(--radius)',
                padding: '6px 12px', textDecoration: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t('share.whatsappButton')}
            </a>
          </div>
        </div>

        {/* Photos */}
        <div className="card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden' }}>
          {photos.length > 0 ? (
            <>
              <img
                src={photos[photoIdx]}
                alt={item.title}
                style={{ width: '100%', height: '340px', objectFit: 'cover' }}
              />
              {photos.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', padding: '12px', overflowX: 'auto' }}>
                  {photos.map((p, i) => (
                    <img
                      key={i} src={p} alt=""
                      onClick={() => setPhotoIdx(i)}
                      style={{
                        width: '64px', height: '64px', objectFit: 'cover',
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                        border: i === photoIdx ? '2px solid #080808' : '2px solid transparent',
                        opacity: i === photoIdx ? 1 : 0.55,
                        transition: 'opacity 0.15s',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>
              <CategoryIcon category={item.category} size={72} />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              {/* Название ведёт, цена уточняет. До правки было наоборот:
                  цена 32px против заголовка 24px — крупнее оказывалось то,
                  что отвечает на второй вопрос, а не на первый. */}
              <h1 style={{ fontSize: 'clamp(var(--text-lg), 5vw, var(--text-xl))', fontWeight: '800', letterSpacing: '-0.025em', marginBottom: 'var(--space-3)' }}>{item.title}</h1>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <span className="tag tag-gray">{t(categoryLabelKey(item.category) ?? '') || item.category}</span>
                <span className="tag tag-gray">{t(conditionLabelKey(item.condition) ?? '') || item.condition}</span>
                {/* Количество показываем, только когда единиц больше одной:
                    «1 единица» на соседской дрели — шум. */}
                {item.quantity > 1 && (
                  <span className="tag tag-gray">{t('itemDetail.units', { count: item.quantity })}</span>
                )}
                {!item.available && <span className="tag tag-red">{t('itemDetail.unavailable')}</span>}
              </div>

              {/* История вещи. Появляется ТОЛЬКО когда она есть: «сдавалась
                  0 раз» на пустой площадке — витрина собственной пустоты, а
                  не доверие. Ровно поэтому же не показываем «0 avis».
                  Отзыв человек пишет редко; факт сдачи лежит в базе сам. */}
              {history && history.times_rented > 0 && (
                <p style={{ marginTop: 'var(--space-2)', color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
                  {t('itemDetail.timesRented', { count: history.times_rented })}
                  {history.last_rented && (
                    <>
                      {' · '}
                      {t('itemDetail.lastRented', {
                        month: new Date(history.last_rented + 'T00:00:00')
                          .toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }),
                      })}
                    </>
                  )}
                </p>
              )}
            </div>
            {/* На узком экране блок переносится под заголовок, и выравнивание
                по правому краю разваливало его посреди пустого места. */}
            <div className="item-price-block">
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: '800', letterSpacing: '-0.04em', lineHeight: 1 }}>
                €{item.price_per_day.toFixed(2)}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-1)' }}>{t('itemDetail.perDay')}</div>
              {/* Тарифы на срок. Показываем только назначенные: пустая строка
                  «— € / semaine» читается как «неделю нельзя». */}
              {hasTiers && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {item.price_3days != null && <div>€{Number(item.price_3days).toFixed(2)} / 3 jours</div>}
                  {item.price_week != null && <div>€{Number(item.price_week).toFixed(2)} / semaine</div>}
                </div>
              )}
              {item.deposit > 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-1)' }}>
                  + €{item.deposit.toFixed(2)} caution
                </div>
              )}
              {/* Доставка показывается, только если владелец её объявил. */}
              {item.delivery_fee != null && (
                <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-1)' }}>
                  {t('itemDetail.deliveryOffer', { fee: Number(item.delivery_fee).toFixed(2) })}
                  {item.delivery_radius_km != null && ' ' + t('itemDetail.deliveryRadius', { km: item.delivery_radius_km })}
                </div>
              )}
              {item.late_fee_per_day != null && (
                <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-1)' }}>
                  Retard : €{Number(item.late_fee_per_day).toFixed(2)} / jour
                </div>
              )}
            </div>
          </div>

          {item.description && (
            <p style={{ color: '#555', lineHeight: '1.7', marginBottom: 'var(--space-4)', fontSize: 'var(--text-base)' }}>{item.description}</p>
          )}

          {item.address && (
            <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>📍 {item.address}</div>
          )}
        </div>

        {/* Owner */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>
            {t('ownerLabel')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {item.users?.avatar_url ? (
              <img src={item.users.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#F2F0EB', fontWeight: '700', flexShrink: 0 }}>
                {item.users?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                {item.users?.full_name}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {item.users?.phone_verified && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#e8f5e9', color: '#2e7d32',
                    fontSize: '11px', fontWeight: '600',
                    padding: '3px 8px', borderRadius: '3px',
                    fontFamily: 'var(--font-mono)',
                  }}>{t('phoneVerified')}</span>
                )}
              </div>
              {item.users?.rating_as_owner ? (
                <div className="rating" style={{ fontSize: '13px' }}>★ {Number(item.users.rating_as_owner).toFixed(1)}</div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{t('newOwner')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Booking calendar */}
        {user?.id !== item.owner_id && item.available && (
          <div className="card" style={{ marginBottom: '20px' }}>
            {error && <div className="error-msg">{error}</div>}

            {requestSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ fontWeight: '800', marginBottom: '8px' }}>{t('itemDetail.requestSent')}</h3>
                {/* Здесь стояло «Vous serez notifié par email» — обещание,
                    которого продукт не держит: ключ Resend не задан, письмо
                    не уходит вовсе. Но и после того, как ключ появится,
                    обещать канал нельзя: 30.07 на гараже письмо с тремя
                    зелёными проверками легло в спам, и Resend показывал
                    «Delivered». Обещаем то, что зависит от нас, — место,
                    где ответ будет виден наверняка. */}
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                  {t('itemDetail.ownerHas24h')}
                </p>
                <a href="/my-rentals" className="btn btn-secondary" style={{ fontSize: '14px' }}>
                  {t('itemDetail.seeMyRentals')}
                </a>
              </div>
            ) : (
              <>
                {/* Здесь стояла кнопка «Contacter via WhatsApp». Она
                    встраивала телефон владельца в ссылку wa.me — то есть
                    показывала чужой номер любому посетителю, тогда как
                    политика конфиденциальности обещает контакт только
                    ПОСЛЕ подтверждённой брони. Столбцы phone/lat/lng
                    закрыты миграцией 20260811000014, переписка живёт
                    внутри брони. */}
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  {t('itemDetail.contactViaBooking')}
                </div>

                {/* Разделитель «ou demander une réservation» разделял два
                    пути — WhatsApp и бронь. Путь остался один, разделять
                    нечего. */}

                {/* === SECONDARY: Calendrier + demande de réservation (connecté) === */}
                {user ? (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                      {t('selectDates')}
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: calendar && calendar.earliestStart > todayISO ? '6px' : '20px' }}>
                      {t('selectDatesHint')}
                    </p>
                    {/* Срок предупреждения сказан СЛОВАМИ, а не только серыми
                        клетками: иначе человек видит недоступное начало
                        месяца и думает, что вещь разобрана. */}
                    {calendar && calendar.earliestStart > todayISO && (
                      <p className="form-hint" style={{ marginBottom: '20px' }}>
                        {t('itemDetail.noticeHint', {
                          date: new Date(calendar.earliestStart + 'T00:00:00').toLocaleDateString(i18n.language),
                        })}
                      </p>
                    )}

                    {/* Calendar nav */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <button
                        onClick={() => setCalMonth(p => {
                          const d = new Date(p.year, p.month - 1)
                          return { year: d.getFullYear(), month: d.getMonth() }
                        })}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer', fontSize: '16px' }}
                      >
                        ‹
                      </button>
                      <strong style={{ fontWeight: '700', fontSize: '14px' }}>{monthLabel}</strong>
                      <button
                        onClick={() => setCalMonth(p => {
                          const d = new Date(p.year, p.month + 1)
                          return { year: d.getFullYear(), month: d.getMonth() }
                        })}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer', fontSize: '16px' }}
                      >
                        ›
                      </button>
                    </div>

                    <div className="cal" style={{ marginBottom: '16px' }}>
                      {['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'].map(d => (
                        <div key={d} className="cal-header">{d}</div>
                      ))}
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysCount }).map((_, i) => {
                        const day = i + 1
                        const ds = toISODate(new Date(year, month, day))
                        const past = ds < todayISO
                        // Три разные причины, по которым день не берётся, и
                        // раньше все три выглядели одинаково — «просто не
                        // нажимается». Теперь у каждой своё объяснение при
                        // наведении и для диктора.
                        const reason = calendar?.unavailable.get(ds)
                        const tooSoon = !past && !!calendar && isTooSoon(calendar, ds)
                        const off = past || tooSoon || !!reason
                        const isStart = ds === startDate
                        const isEnd = ds === endDate
                        const inRange = startDate && endDate && ds >= startDate && ds <= endDate
                        const isToday = ds === todayISO
                        const why = reason === 'booked' ? t('itemDetail.dayBooked')
                          : reason === 'blocked' ? t('itemDetail.dayBlocked')
                          : tooSoon ? t('itemDetail.dayTooSoon')
                          : past ? t('itemDetail.dayPast')
                          : undefined
                        return (
                          <div
                            key={day}
                            className={`cal-day ${off ? 'booked' : 'available'}${isToday ? ' today' : ''}`}
                            title={why}
                            aria-disabled={off || undefined}
                            aria-label={why ? `${day} — ${why}` : undefined}
                            style={{
                              background: isStart || isEnd ? '#080808'
                                : inRange ? 'rgba(173,255,47,0.15)'
                                : reason === 'booked' ? '#fde8ea'
                                : past || tooSoon || reason ? '#f5f5f5'
                                : undefined,
                              color: isStart || isEnd ? '#F2F0EB'
                                : reason === 'booked' ? 'var(--danger)'
                                : past || tooSoon || reason ? '#ccc'
                                : undefined,
                              cursor: off ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => !off && handleDayClick(day)}
                          >
                            {day}
                          </div>
                        )
                      })}
                    </div>

                    {startDate && (
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                        <div><span style={{ color: 'var(--muted)' }}>Du </span>{startDate}</div>
                        {endDate && <div><span style={{ color: 'var(--muted)' }}>Au </span>{endDate}</div>}
                        {totalDays > 0 && <div style={{ fontWeight: '700' }}>{totalDays} jour{totalDays > 1 ? 's' : ''}</div>}
                      </div>
                    )}

                    {totalDays > 0 && (
                      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', fontSize: '14px' }}>
                        {/* Разбор по тарифам. Без него итог выглядит взятым с
                            потолка: человек умножает дни на дневную цену, не
                            сходится, и он перестаёт верить числу. */}
                        {rental.weeks > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--muted)' }}>€{Number(item.price_week).toFixed(2)} × {rental.weeks} semaine{rental.weeks > 1 ? 's' : ''}</span>
                            <span>€{(Number(item.price_week) * rental.weeks).toFixed(2)}</span>
                          </div>
                        )}
                        {rental.packs3 > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--muted)' }}>€{Number(item.price_3days).toFixed(2)} × {rental.packs3} forfait{rental.packs3 > 1 ? 's' : ''} 3 jours</span>
                            <span>€{(Number(item.price_3days) * rental.packs3).toFixed(2)}</span>
                          </div>
                        )}
                        {rental.days > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--muted)' }}>€{item.price_per_day.toFixed(2)} × {rental.days} jour{rental.days > 1 ? 's' : ''}</span>
                            <span>€{(item.price_per_day * rental.days).toFixed(2)}</span>
                          </div>
                        )}
                        {savedVsDaily > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--muted)' }}>
                            <span>{t('itemDetail.packageApplied')}</span>
                            <span>− €{savedVsDaily.toFixed(2)}</span>
                          </div>
                        )}
                        {item.deposit > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--muted)' }}>{t('itemDetail.deposit')}</span>
                            <span>€{item.deposit.toFixed(2)}</span>
                          </div>
                        )}
                        {deliveryFee > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--muted)' }}>{t('itemDetail.delivery')}</span>
                            <span>€{deliveryFee.toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '20px', letterSpacing: '-0.03em', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                          <span>{t('itemDetail.estimatedTotal')}</span>
                          <span>€{totalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Выбор доставки. Стоит перед сообщением владельцу и
                        после итога: человек видит, как меняется сумма, до
                        того как отправит заявку. */}
                    {totalDays > 0 && item.delivery_fee != null && (
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label htmlFor="wants-delivery" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                          <input
                            id="wants-delivery"
                            type="checkbox"
                            checked={wantsDelivery}
                            onChange={e => setWantsDelivery(e.target.checked)}
                            style={{ width: 'auto', minHeight: 0 }}
                          />
                          {t('itemDetail.deliveryAsk', { fee: Number(item.delivery_fee).toFixed(2) })}
                        </label>
                        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                          {t('itemDetail.deliveryNote')}
                        </p>
                      </div>
                    )}

                    {totalDays > 0 && (
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label htmlFor="request-message" style={{ fontSize: '13px', color: 'var(--muted)' }}>{t('itemDetail.messageToOwner')}</label>
                        <textarea
                          id="request-message"
                          value={requestMessage}
                          onChange={e => setRequestMessage(e.target.value)}
                          placeholder={t('itemDetail.messagePlaceholder')}
                          rows={2}
                          maxLength={300}
                          style={{ marginTop: '6px', fontSize: '14px' }}
                        />
                        {/* Часа выдачи и возврата в продукте нет: start_date и
                            end_date хранятся ДАТАМИ, без времени. У шведского
                            проката, с которого взята доставка, время стоит
                            прямо в заявке — «выдача 08:00, возврат 17:00», и
                            это половина договорённости.
                            Менять тип столбца — значит трогать расчёт занятости,
                            сведённый в один источник 17.08. Поэтому дешёвая
                            половина: не выдумываем поле, а ЗОВЁМ сказать время
                            там, где текст и так уходит владельцу письмом. */}
                        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                          {t('itemDetail.handoverTimeHint')}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleRequest}
                      disabled={!startDate || !endDate || requestLoading}
                      className="btn btn-primary"
                      style={{ width: '100%', minHeight: '44px', fontSize: '15px' }}
                    >
                      {requestLoading ? t('common.loading') : !startDate || !endDate ? t('selectDatesHint') : t('itemDetail.sendRequest')}
                    </button>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: '8px' }}>
                      {/* Ключ намеренно назван по факту, а не по отрицанию:
                          `noOnlinePayment` содержал и «payment», и «online»,
                          и страж утверждений спотыкался о ИМЯ ключа, не
                          видя текста. Гейт с ложными срабатываниями
                          перестают читать. */}
                      {t('itemDetail.cashAtHandover')}
                    </p>
                  </>
                ) : (
                  <a href="/login" className="btn btn-secondary" style={{ width: '100%', display: 'block', textAlign: 'center', minHeight: '44px' }}>
                    {t('loginToBook')}
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {user?.id === item.owner_id && (
          <div className="card" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('yourListing')} — </span>
            <a href="/my-items" style={{ fontWeight: '700', textDecoration: 'underline' }}>{t('manageIt')}</a>
          </div>
        )}

        {!item.available && user?.id !== item.owner_id && (
          <div className="card" style={{ marginBottom: '20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            {t('itemDetail.currentlyUnavailable')}
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
              Avis
            </p>
            {avgRating && (
              <div className="rating" style={{ marginBottom: '16px' }}>
                ★ {avgRating.toFixed(1)}
                <span style={{ color: 'var(--muted)', fontWeight: '400', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                  {' '}({reviews.length} avis)
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.map(r => (
                <div key={r.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '14px' }}>{(r.users as any)?.full_name || 'Anonyme'}</strong>
                    <span className="rating" style={{ fontSize: '13px' }}>{'★'.repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.6 }}>{r.comment}</p>}
                  <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canReview && (
          <div className="card">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
              {t('review.leaveTitle')}
            </p>
            {reviewSuccess ? (
              <div className="success-msg">{t('review.thanks')}</div>
            ) : (
              <form onSubmit={handleReviewSubmit}>
                {/* Оценка звёздами. `<label>` здесь не годится: она умеет
                    указывать на ОДНО поле, а тут ряд кнопок. Поэтому
                    подпись — обычный текст, а группа связана с ней через
                    `aria-labelledby`.
                    Сама выбранная оценка сообщалась ТОЛЬКО цветом — диктор
                    читал пять одинаковых «звёздочка» и не мог сказать, что
                    выбрано. Теперь у каждой кнопки имя («3 étoiles») и
                    `aria-pressed`. */}
                <div className="form-group">
                  <span id="review-rating-label" className="form-label-text">{t('review.ratingLabel')}</span>
                  <div
                    role="group"
                    aria-labelledby="review-rating-label"
                    style={{ display: 'flex', gap: '4px', marginTop: '8px' }}
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setReviewStars(n)}
                        aria-label={t(n === 1 ? 'booking.reviewStarOne' : 'booking.reviewStarMany', { count: n })}
                        aria-pressed={n === reviewStars}
                        style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', color: n <= reviewStars ? 'var(--warning)' : '#ddd', padding: '0 2px', transition: 'color 0.15s' }}>
                        <span aria-hidden="true">★</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="review-comment">{t('review.commentLabel')}</label>
                  <textarea id="review-comment" value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder={t('itemDetail.shareExperience')} rows={3} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={reviewLoading} style={{ minHeight: '44px' }}>
                  {reviewLoading ? t('common.loading') : t('itemDetail.submitReview')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
