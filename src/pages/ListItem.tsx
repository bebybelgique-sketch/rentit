import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useBeforeUnload, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CATEGORIES, CONDITIONS, categoryPriceHintKey } from '../domain/catalog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Категории и состояния — из src/domain/catalog.ts. Здесь была четвёртая
// копия списка категорий и третья копия состояний.

// Подсказка цен была седьмым местом, где перечислены категории: добавь
// категорию — и подсказки не будет только здесь, молча.

// Числа живут ЗДЕСЬ и подставляются в тексты через {{max}} и {{size}}.
// До 16.08 «5» была записана и в коде, и словом в трёх словарях: поменяй
// одно — и продукт начинает обещать одно, а делать другое.
const MAX_PHOTOS = 5
const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

// Границы полей доступности. Те же числа стоят проверками в базе
// (миграция 20260817000022): здесь они нужны, чтобы человек получил ответ
// на своей странице, а не отказ Postgres по-английски.
const MAX_QUANTITY = 999
const MAX_NOTICE_DAYS = 90
const MAX_BUFFER_DAYS = 30

export default function ListItem() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: CATEGORIES[0].value as string,
    condition: 'good',
    price_per_day: '',
    price_3days: '',
    price_week: '',
    late_fee_per_day: '',
    deposit: '',
    address: '',
    // Доступность. Умолчания — ровно прежнее поведение продукта: одна
    // единица, без зазора, без предупреждения. Сосед с одной дрелью не
    // заметит, что поля появились; прокатчик со стульями без них не зайдёт.
    quantity: '1',
    min_notice_days: '0',
    buffer_days: '0',
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  // Отказы по фотографиям отдельно от `error`: они показываются у самих
  // фотографий, а не в шапке формы за несколько экранов оттуда.
  const [photoNotice, setPhotoNotice] = useState<string[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [needsPhoto, setNeedsPhoto] = useState(false)
  // Просьбу о фото можно отложить. Отказ живёт в состоянии страницы:
  // повторно в том же заходе она не показывается, но и не запоминается
  // навсегда — при следующем объявлении спросим снова, мягко.
  const [photoDeferred, setPhotoDeferred] = useState(false)
  const [estimatedValue, setEstimatedValue] = useState('')

  // Есть ли фото профиля. Раньше отсутствие фото ЗАКРЫВАЛО выкладку:
  // человек нажимал «déposer un outil» и получал вместо формы требование
  // сфотографироваться. Это точка максимального трения при минимальной
  // пользе — он ещё ни с кем не встретился, броней нет, а его уже не
  // пускают. При нуле предложения это самая дорогая протечка воронки.
  //
  // Как делают площадки (проверено 12.08): на Leboncoin и Vinted фото
  // профиля рекомендуется, но публиковать без него можно. Airbnb в
  // октябре 2018 пошёл дальше и УБРАЛ фото гостя из экрана запроса —
  // открывает его только после подтверждения брони, потому что видимое
  // фото до решения измеримо повышало отказы по «неправильному» имени.
  // Жёсткое требование фото живёт там, где человек садится в чужую
  // машину или ночует в чужом доме, и где площадка держит деньги. Мы не
  // оттуда: денег не касаемся, ночевать не сводим.
  //
  // Свой же принцип у продукта уже есть и он верный: телефон второй
  // стороны открывается только после подтверждённой брони. Личность
  // раскрывается тогда, когда она нужна, — в момент встречи, а не в
  // момент публикации. Фото приведено к тому же правилу: просьба, а не
  // стена. НЕ возвращать блокировку без отдельного решения.
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data?.avatar_url) setNeedsPhoto(true)
      })
  }, [user])

  // Auto-calculate deposit at 20% of estimated value
  const handleValueChange = (val: string) => {
    setEstimatedValue(val)
    const v = parseFloat(val)
    if (!isNaN(v) && v > 0) {
      setForm(p => ({ ...p, deposit: (v * 0.20).toFixed(0) }))
    }
  }

  // Track if form has been touched
  useEffect(() => {
    const hasContent = form.title || form.description || form.price_per_day || photos.length > 0
    setIsDirty(!!hasContent)
  }, [form.title, form.description, form.price_per_day, photos.length])

  // Warn on browser tab close / refresh
  useBeforeUnload(
    useCallback(
      (e) => {
        if (isDirty && !uploading) {
          e.preventDefault()
        }
      },
      [isDirty, uploading]
    )
  )

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  // Выбор фотографий. Три вещи, которые здесь делались молча, и все три
  // человек замечал уже после публикации — то есть никогда:
  //
  //   1. `.slice(0, 5)` отрезал лишние БЕЗ ЕДИНОГО СЛОВА. Выбрал восемь —
  //      три исчезли, и владелец уверен, что загрузил восемь;
  //   2. новый выбор ЗАМЕНЯЛ предыдущий, а не добавлял. Выбрал три, потом
  //      ещё две — осталось две. На телефоне снимки выбирают по одному из
  //      галереи, так что это был основной путь, а не край;
  //   3. один негодный файл отменял ВЕСЬ выбор: пять фотографий, одна на
  //      6 МБ — не добавилось ничего.
  //
  // Теперь: годные добавляются к уже выбранным, негодные пропускаются
  // поимённо, и человеку говорят, что именно не взяли и почему.
  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || [])

    // Сбрасываем ввод сразу: без этого повторный выбор ТОГО ЖЕ файла не
    // вызывает `change`, и человек жмёт по кнопке в пустоту.
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (picked.length === 0) return

    const problems: string[] = []
    const valid: File[] = []
    setPhotoNotice([])
    for (const file of picked) {
      if (!file.type.startsWith('image/')) {
        problems.push(t('listItem.notAnImage', { name: file.name }))
      } else if (file.size > MAX_FILE_SIZE) {
        problems.push(t('listItem.photoTooLarge', { name: file.name, size: MAX_FILE_SIZE_MB }))
      } else {
        valid.push(file)
      }
    }

    const free = Math.max(0, MAX_PHOTOS - photos.length)
    const added = valid.slice(0, free)
    const dropped = valid.length - added.length
    if (dropped > 0) {
      problems.push(t('listItem.photoLimitReached', { count: dropped, max: MAX_PHOTOS }))
    }

    if (added.length > 0) {
      setPhotos(p => [...p, ...added])
      setPhotoPreviews(p => [...p, ...added.map(f => URL.createObjectURL(f))])
    }
    // Отказы по фотографиям живут рядом с фотографиями, а не в шапке
    // формы: `error` остаётся за отказами публикации целиком.
    setPhotoNotice(problems)
  }

  const photosLeft = MAX_PHOTOS - photos.length

  const removePhoto = (i: number) => {
    // Освобождаем именно этот URL. Раньше при новом выборе отзывались ВСЕ
    // превью разом — с добавлением это оставило бы уже показанные
    // картинки битыми.
    URL.revokeObjectURL(photoPreviews[i])
    setPhotos(p => p.filter((_, idx) => idx !== i))
    setPhotoPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const getLocation = () => {
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setGeoLoading(false)
        // Reverse-geocode via free Nominatim API so address stays in sync
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
        )
          .then(r => r.json())
          .then(data => {
            if (data?.display_name) {
              // Trim to street + city
              const parts = data.display_name.split(',')
              const short = parts.slice(0, 3).join(',').trim()
              setForm(p => ({ ...p, address: short }))
            }
          })
          .catch(() => {}) // silent fail — address field remains editable
      },
      () => {
        setGeoLoading(false)
        setError(t('listItem.geolocationDenied'))
      },
      { timeout: 10000 }
    )
  }

  // Тариф дороже того же срока по дням никогда не будет выбран расчётом —
  // он просто мёртвый. Владелец об этом узнать неоткуда: он вводит «40 € за
  // 3 дня» при дневной цене 12 € и считает, что сделал скидку. Говорим сразу,
  // при вводе, а не отказом при отправке: тариф не ошибка, он бесполезен.
  const tierHint = (() => {
    const day = parseFloat(form.price_per_day)
    if (!(day > 0)) return ''
    const dead: string[] = []
    const p3 = parseFloat(form.price_3days)
    if (p3 > 0 && p3 >= day * 3) dead.push(`${t('listItem.package3Days')} (€${p3.toFixed(2)}) ${t('listItem.packageWeek') /* coûte plus que 3 jours */} (€${(day * 3).toFixed(2)})`)
    const pw = parseFloat(form.price_week)
    if (pw > 0 && pw >= day * 7) dead.push(`${t('listItem.packageWeek')} (€${pw.toFixed(2)}) ${t('listItem.packageWeek') /* coûte plus que 7 jours */} (€${(day * 7).toFixed(2)})`)
    if (dead.length === 0) return ''
    return t('listItem.packageWarning', { packages: dead.join(' ; ') })
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!form.title.trim())           return setError(t('listItem.titleRequired'))
    if (!form.price_per_day || parseFloat(form.price_per_day) <= 0)
                                       return setError(t('listItem.priceMustBePositive'))
    if (parseFloat(form.deposit || '0') < 0)
                                       return setError(t('listItem.depositNonNegative'))
    // Ноль в необязательном поле — не «нет тарифа», а «неделя бесплатно».
    // База такое отклонит проверкой, но человеку нужен ответ здесь, а не
    // невнятный отказ Postgres на французской странице.
    for (const [field, label] of [
      ['price_3days', t('listItem.package3Days')],
      ['price_week', t('listItem.packageWeek')],
      ['late_fee_per_day', t('listItem.lateFeesLabel')],
    ] as const) {
      const raw = form[field]
      if (raw !== '' && !(parseFloat(raw) > 0))
        return setError(t('listItem.tierMustBePositive', { label }))
    }

    // Целые поля доступности. Проверка та же, что в базе, но ответ здесь —
    // отказ Postgres на французской странице человеку ничего не говорит.
    for (const [field, label, min, max] of [
      ['quantity', t('listItem.quantityLabel'), 1, MAX_QUANTITY],
      ['min_notice_days', t('listItem.noticeLabel'), 0, MAX_NOTICE_DAYS],
      ['buffer_days', t('listItem.bufferLabel'), 0, MAX_BUFFER_DAYS],
    ] as const) {
      const n = parseInt(form[field] || String(min), 10)
      if (!Number.isInteger(n) || n < min || n > max)
        return setError(t('listItem.numberRange', { label, min, max }))
    }

    try {
      setUploading(true)
      setUploadProgress(0)
      setError('')

      // Check for duplicate listings by this owner
      const { data: existing } = await supabase
        .from('items')
        .select('id, title')
        .eq('owner_id', user.id)
        .ilike('title', `%${form.title.trim().slice(0, 20)}%`)

      if (existing && existing.length > 0) {
        const confirmed = window.confirm(
          t('listItem.duplicateConfirm', { title: existing[0].title })
        )
        if (!confirmed) {
          setUploading(false)
          return
        }
      }

      const photoUrls: string[] = []
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(i + 1)
        const file = photos[i]
        const ext  = file.name.split('.').pop()
        const path = `items/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('item-photos').upload(path, file)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('item-photos').getPublicUrl(path)
        photoUrls.push(publicUrl)
      }

      const { data, error: insertErr } = await supabase.from('items').insert([{
        owner_id:      user.id,
        title:         form.title.trim(),
        description:   form.description.trim() || null,
        category:      form.category,
        condition:     form.condition,
        price_per_day: parseFloat(form.price_per_day),
        // Пустое поле уходит как NULL, а не как 0: ноль в базе означал бы
        // «неделя бесплатно», и расчёт принял бы его всерьёз.
        price_3days:      form.price_3days      === '' ? null : parseFloat(form.price_3days),
        price_week:       form.price_week       === '' ? null : parseFloat(form.price_week),
        late_fee_per_day: form.late_fee_per_day === '' ? null : parseFloat(form.late_fee_per_day),
        deposit:       parseFloat(form.deposit) || 0,
        photos:        photoUrls,
        lat,
        lng,
        address:       form.address.trim() || null,
        available:     true,
        quantity:        parseInt(form.quantity || '1', 10),
        min_notice_days: parseInt(form.min_notice_days || '0', 10),
        buffer_days:     parseInt(form.buffer_days || '0', 10),
      }]).select().single()

      if (insertErr) throw insertErr

      setIsDirty(false) // prevent leave-warning after successful submit
      navigate(`/item/${data.id}?published=1`)
    } catch (err: any) {
      setError(err.message || t('listItem.couldNotCreate'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const isLocked = uploading

  if (needsPhoto && !photoDeferred) return (
    <div className="page" style={{ maxWidth: '480px', margin: '60px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '56px', marginBottom: '20px' }}>📸</div>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.02em' }}>
        {t('addPhotoFirst')}
      </h2>
      <p style={{ color: 'var(--muted)', marginBottom: '8px', lineHeight: '1.6' }}>
        {t('addPhotoDesc')}
      </p>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px' }}>
        {t('addPhotoHint')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
        <Link to="/profile" className="btn btn-primary" style={{ minHeight: '48px', fontSize: '16px', padding: '14px 32px' }}>
          {t('addPhotoBtn')}
        </Link>
        {/* Выход, которого не было. Без него экран — стена. */}
        <button
          type="button"
          onClick={() => setPhotoDeferred(true)}
          className="btn btn-secondary"
          style={{ minHeight: '44px', fontSize: '15px', padding: '10px 24px' }}
        >
          {t('addPhotoLater')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
            {t('newListing')}
          </p>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: '800', letterSpacing: '-0.03em' }}>
            {t('listYourTool')}
          </h1>
        </div>

        {/* ПОРЯДОК ЭКРАНА — не косметика, а обещание лендинга.
            Лендинг говорит «Cinq minutes, sans frais», а форма показывала
            ОДИННАДЦАТЬ полей сразу: залог, тариф на 3 дня, тариф на неделю,
            плату за просрочку — то есть разговор про деньги раньше, чем
            человек успел показать инструмент. Критика 15.08 замерила это
            как главное расхождение продукта.

            Теперь на первом экране ровно то, без чего объявления не
            существует: фотография, название, категория, цена за день.
            Всё остальное живёт в <details> и НЕ ИСЧЕЗЛО — оно необязательно
            и правится после публикации через «Modifier».

            Фотография поднята наверх намеренно: для аренды это главный
            аргумент, а стояла она последней и самым тихим элементом.

            Позиция осталась здесь же, но НАЖАТИЕМ, а не полем: без
            координат вещь не попадает в поиск «À proximité» вовсе, и
            владелец об этом никогда не узнает. Адрес текстом — в
            подробностях, он только показывается арендатору. */}
        <form onSubmit={handleSubmit} className="card">
          {error && <div className="error-msg">{error}</div>}

          {/* Photos — первым.
              Правило сказано СЛОВАМИ до того, как в него упрутся, счётчик
              виден всегда, а отказ стоит здесь же, а не в шапке формы.
              Раньше здесь была одна серая строчка мелким шрифтом — и всё:
              сколько можно загрузить, человек узнавал, только упёршись. */}
          <div className="form-group">
            <label htmlFor="li-photos">{t('listItem.photosFirstLabel')}</label>
            <p className="form-hint">
              {t('listItem.photosRule', { max: MAX_PHOTOS, size: MAX_FILE_SIZE_MB })}
              {' '}
              {t('listItem.photosWhy')}
            </p>

            <input
              id="li-photos"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotos}
              style={{ display: 'none' }}
              disabled={isLocked}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLocked || photosLeft === 0}
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: '44px' }}
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="7" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 3V2.5A1.5 1.5 0 0 1 6.5 1h1A1.5 1.5 0 0 1 9 2.5V3" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              {photos.length === 0
                ? t('listItem.photosChoose')
                : photosLeft === 0
                  ? t('listItem.photosFull')
                  : t('listItem.photosAddMore', { count: photosLeft })}
            </button>

            {/* Сколько уже есть — видно всегда, а не только когда упрёшься. */}
            {photos.length > 0 && (
              <p className="form-hint" aria-live="polite">
                {t('listItem.photosCounter', { count: photos.length, max: MAX_PHOTOS })}
                {photosLeft === 0 && <> {t('listItem.photosFullNote')}</>}
              </p>
            )}

            {/* Отказ — здесь же, поимённо и с причиной. Раньше он уезжал в
                шапку формы, за несколько экранов от фотографий. */}
            {photoNotice.length > 0 && (
              <ul className="form-notice" aria-live="polite">
                {photoNotice.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            )}

            {photoPreviews.length > 0 && (
              <div className="photo-grid" style={{ marginTop: 'var(--space-3)' }}>
                {photoPreviews.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} className="photo-thumb" alt="" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      disabled={isLocked}
                      aria-label={t('listItem.deletePhoto')}
                      style={{
                        position: 'absolute', top: '2px', right: '2px',
                        background: 'rgba(18,20,23,0.7)', color: 'var(--text-on-dark)',
                        border: 'none', borderRadius: '50%',
                        width: '24px', height: '24px', fontSize: '14px',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="form-group">
            <label htmlFor="li-title">{t('listItem.titleLabel')}</label>
            <input
              id="li-title"
              value={form.title}
              onChange={set('title')}
              placeholder={t('listItem.titlePlaceholder')}
              required
              disabled={isLocked}
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label htmlFor="li-category">{t('listItem.categoryLabel')}</label>
            <select id="li-category" value={form.category} onChange={set('category')} disabled={isLocked}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Price per day */}
          <div className="form-group">
            <label htmlFor="li-price">{t('listItem.pricePerDayLabel')}</label>
            <input
              id="li-price"
              type="number"
              min="0.50"
              step="0.50"
              value={form.price_per_day}
              onChange={set('price_per_day')}
              placeholder="10.00"
              required
              disabled={isLocked}
            />
            {form.category && (
              <p className="form-hint">{t(categoryPriceHintKey(form.category) ?? '')}</p>
            )}
          </div>

          {/* Позиция — одно нажатие. Кнопка называет ОДНО состояние, а не
              оба сразу: до 15.08 строка словаря была
              «✓ Position définie / 📍 Ma position», и человек не мог
              понять, сработало у него или нет. */}
          <div className="form-group">
            <button
              type="button"
              onClick={getLocation}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: '44px' }}
              disabled={geoLoading || isLocked}
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1C4.79 1 3 2.79 3 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="7" cy="5" r="1.5" fill="currentColor"/>
              </svg>
              {geoLoading ? t('common.loading') : lat !== null ? t('listItem.positionSet') : t('listItem.setPosition')}
            </button>
            {lat !== null
              ? <p className="form-hint">{lat.toFixed(4)}, {lng?.toFixed(4)}</p>
              : <p className="form-hint">{t('listItem.positionMissing')}</p>}
          </div>

          {/* Всё необязательное — за раскрытием. Нативный <details>, а не
              своя реализация: работает с клавиатуры и с диктором без
              единой строки JS, и это не модальное окно. */}
          <details className="form-details">
            <summary>
              <svg className="form-details-caret" width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                <path d="M2.5 1L6.5 4.5L2.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t('listItem.detailsSummary')}
              <span className="form-details-hint">{t('listItem.detailsHint')}</span>
            </summary>

            {/* Доступность. Стоит первой в раскрытии не случайно: без
                количества единиц прокатчик с двенадцатью одинаковыми
                стульями не выложится вовсе — двенадцать объявлений он
                заводить не станет. Для соседа с одной дрелью здесь
                правильные умолчания, и трогать их не нужно. */}
            <div className="form-group">
              <label htmlFor="li-quantity">{t('listItem.quantityLabel')}</label>
              <input
                id="li-quantity"
                type="number"
                min="1"
                max={MAX_QUANTITY}
                step="1"
                value={form.quantity}
                onChange={set('quantity')}
                disabled={isLocked}
              />
              <p className="form-hint">{t('listItem.quantityHint')}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="li-notice">{t('listItem.noticeLabel')}</label>
                <input
                  id="li-notice"
                  type="number"
                  min="0"
                  max={MAX_NOTICE_DAYS}
                  step="1"
                  value={form.min_notice_days}
                  onChange={set('min_notice_days')}
                  disabled={isLocked}
                />
                <p className="form-hint">{t('listItem.noticeHint')}</p>
              </div>
              <div className="form-group">
                <label htmlFor="li-buffer">{t('listItem.bufferLabel')}</label>
                <input
                  id="li-buffer"
                  type="number"
                  min="0"
                  max={MAX_BUFFER_DAYS}
                  step="1"
                  value={form.buffer_days}
                  onChange={set('buffer_days')}
                  disabled={isLocked}
                />
                <p className="form-hint">{t('listItem.bufferHint')}</p>
              </div>
            </div>

            {/* Перерывы (отпуск, ремонт) задаются ПОСЛЕ публикации, на
                странице «Modifier»: пока вещи нет, привязывать даты не к
                чему, а лишний блок в форме выкладки стоит дороже. */}
            <p className="form-hint">{t('listItem.blackoutsLater')}</p>

            <div className="form-group">
              <label htmlFor="li-condition">{t('listItem.conditionLabel')}</label>
              <select id="li-condition" value={form.condition} onChange={set('condition')} disabled={isLocked}>
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="li-description">{t('form.description')}</label>
              <textarea
                id="li-description"
                value={form.description}
                onChange={set('description')}
                placeholder={t('listItem.descriptionHint')}
                rows={3}
                disabled={isLocked}
              />
            </div>

            <div className="form-group">
              <label htmlFor="li-address">{t('listItem.addressLabel')}</label>
              <input
                id="li-address"
                value={form.address}
                onChange={set('address')}
                disabled={isLocked}
              />
            </div>

            {/* Залог: подсказка стоит ПОДПИСЬЮ, а не в поле. Раньше
                «Calculée automatiquement à 20% de la valeur» лежало
                плейсхолдером — то есть текст занимал место, где ждут
                число, и понять, заполнено оно или нет, было нельзя. */}
            <div className="form-group">
              <label htmlFor="li-value">{t('listItem.estimatedValueLabel')}</label>
              <input
                id="li-value"
                type="number"
                value={estimatedValue}
                onChange={e => handleValueChange(e.target.value)}
                min="0"
                disabled={isLocked}
              />
              <p className="form-hint">{t('listItem.depositHint')}</p>
            </div>

            <div className="form-group">
              <label htmlFor="li-deposit">
                {t('listItem.depositLabel')}{' '}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('common.refundableAtReturn')}</span>
              </label>
              <input
                id="li-deposit"
                type="number"
                min="0"
                step="1"
                value={form.deposit}
                onChange={set('deposit')}
                disabled={isLocked}
              />
            </div>

            {/* Тарифы на срок необязательны: пустое поле означает «такого
                тарифа нет», и счёт идёт по дневной цене. Подсказка про
                общую сумму не случайна — без неё человек вводит цену за
                день внутри пакета, а не за весь пакет. */}
            {/* auto-fit, а не жёсткие 1fr 1fr: на 390px две колонки резали
                подсказки до «prix total des 3 jc». Сетка сама схлопывается
                в одну колонку, без брейкпоинта. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label htmlFor="li-p3">
                  {t('listItem.package3DaysLabel')}{' '}
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('common.optional')}</span>
                </label>
                <input
                  id="li-p3"
                  type="number"
                  min="0.50"
                  step="0.50"
                  value={form.price_3days}
                  onChange={set('price_3days')}
                  placeholder={t('listItem.package3DaysHint')}
                  disabled={isLocked}
                />
              </div>
              <div className="form-group">
                <label htmlFor="li-pw">
                  {t('listItem.packageWeekLabel')}{' '}
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('common.optional')}</span>
                </label>
                <input
                  id="li-pw"
                  type="number"
                  min="0.50"
                  step="0.50"
                  value={form.price_week}
                  onChange={set('price_week')}
                  placeholder={t('listItem.packageWeekHint')}
                  disabled={isLocked}
                />
              </div>
            </div>
            {tierHint && <p className="form-hint">{tierHint}</p>}

            {/* Просрочка. Платформа её НЕ считает и НЕ удерживает — это
                цифра, которую владелец объявляет заранее, чтобы при
                встрече не спорить. */}
            <div className="form-group">
              <label htmlFor="li-late">
                {t('listItem.lateFeeLabel')}{' '}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('common.optional')}</span>
              </label>
              <input
                id="li-late"
                type="number"
                min="0.50"
                step="0.50"
                value={form.late_fee_per_day}
                onChange={set('late_fee_per_day')}
                disabled={isLocked}
              />
              <p className="form-hint">{t('listItem.lateFeeNote')}</p>
            </div>
          </details>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-5)', minHeight: '48px' }}
            disabled={isLocked}
          >
            {uploading
              ? photos.length > 0
                ? t('listItem.uploadingPhoto', { done: uploadProgress, total: photos.length })
                : t('publishing')
              : t('publishListing')}
          </button>
        </form>
      </div>
    </div>
  )
}
