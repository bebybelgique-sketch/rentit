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

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

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
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
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

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files || []).slice(0, 5)

    // Validate size + type
    for (const file of raw) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} n'est pas une image.`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} dépasse la limite de 5 Mo.`)
        return
      }
    }

    // Revoke any previous previews before replacing
    photoPreviews.forEach(url => URL.revokeObjectURL(url))

    setPhotos(raw)
    setPhotoPreviews(raw.map(f => URL.createObjectURL(f)))
    setError('')
  }

  const removePhoto = (i: number) => {
    // Free memory immediately
    URL.revokeObjectURL(photoPreviews[i])
    setPhotos(p => p.filter((_, idx) => idx !== i))
    setPhotoPreviews(p => p.filter((_, idx) => idx !== i))
    // Reset native input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
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
        setError('Accès à la localisation refusé. Veuillez saisir votre adresse manuellement.')
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
    if (p3 > 0 && p3 >= day * 3) dead.push(`le forfait 3 jours (€${p3.toFixed(2)}) coûte plus que 3 jours au tarif journalier (€${(day * 3).toFixed(2)})`)
    const pw = parseFloat(form.price_week)
    if (pw > 0 && pw >= day * 7) dead.push(`le forfait semaine (€${pw.toFixed(2)}) coûte plus que 7 jours au tarif journalier (€${(day * 7).toFixed(2)})`)
    if (dead.length === 0) return ''
    return `Attention : ${dead.join(' ; ')}. Le locataire paiera toujours le tarif le moins cher, donc ce forfait ne s'appliquera jamais.`
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!form.title.trim())           return setError('Le titre est requis.')
    if (!form.price_per_day || parseFloat(form.price_per_day) <= 0)
                                       return setError('Le prix doit être supérieur à 0.')
    if (parseFloat(form.deposit || '0') < 0)
                                       return setError('La caution ne peut pas être négative.')
    // Ноль в необязательном поле — не «нет тарифа», а «неделя бесплатно».
    // База такое отклонит проверкой, но человеку нужен ответ здесь, а не
    // невнятный отказ Postgres на французской странице.
    for (const [field, label] of [
      ['price_3days', 'Le forfait 3 jours'],
      ['price_week', 'Le forfait semaine'],
      ['late_fee_per_day', 'Le montant de retard'],
    ] as const) {
      const raw = form[field]
      if (raw !== '' && !(parseFloat(raw) > 0))
        return setError(`${label} doit être supérieur à 0, ou laissé vide.`)
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
          `Vous avez déjà une annonce similaire : "${existing[0].title}". Créer une autre ?`
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
      }]).select().single()

      if (insertErr) throw insertErr

      setIsDirty(false) // prevent leave-warning after successful submit
      navigate(`/item/${data.id}?published=1`)
    } catch (err: any) {
      setError(err.message || "Impossible de créer l'annonce. Veuillez réessayer.")
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

        <form onSubmit={handleSubmit} className="card">
          {error && <div className="error-msg">{error}</div>}

          {/* Title */}
          <div className="form-group">
            <label>Titre de l'outil *</label>
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="ex. Perceuse Bosch, Nettoyeur haute pression..."
              required
              disabled={isLocked}
            />
          </div>

          {/* Category + Condition */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Catégorie *</label>
              <select value={form.category} onChange={set('category')} disabled={isLocked}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>État *</label>
              <select value={form.condition} onChange={set('condition')} disabled={isLocked}>
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              placeholder="Dimensions, caractéristiques, accessoires inclus, règles..."
              rows={3}
              disabled={isLocked}
            />
          </div>

          {/* Price + Deposit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Prix par jour (€) *</label>
              <input
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
                <p style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '5px', lineHeight: 1.5 }}>
                  {t(categoryPriceHintKey(form.category) ?? '')}
                </p>
              )}
            </div>
            <div className="form-group">
              <label>Valeur estimée de l'outil (€)</label>
              <input
                type="number"
                value={estimatedValue}
                onChange={e => handleValueChange(e.target.value)}
                placeholder="ex. 250"
                min="0"
                disabled={isLocked}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '5px' }}>
                Aide à calculer une caution équitable
              </p>
            </div>
          </div>

          {/* Тарифы на срок. Необязательны: пустое поле означает «такого
              тарифа нет», и счёт идёт по дневной цене. Подсказка про 12/40/70
              не случайна — без примера человек не понимает, что вводить цену
              за ВЕСЬ пакет, а не за день внутри него. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Forfait 3 jours (€) <span style={{ color: 'var(--muted)', fontWeight: '400' }}>— optionnel</span></label>
              <input
                type="number"
                min="0.50"
                step="0.50"
                value={form.price_3days}
                onChange={set('price_3days')}
                placeholder="prix total des 3 jours"
                disabled={isLocked}
              />
            </div>
            <div className="form-group">
              <label>Forfait semaine (€) <span style={{ color: 'var(--muted)', fontWeight: '400' }}>— optionnel</span></label>
              <input
                type="number"
                min="0.50"
                step="0.50"
                value={form.price_week}
                onChange={set('price_week')}
                placeholder="prix total des 7 jours"
                disabled={isLocked}
              />
            </div>
          </div>
          {tierHint && (
            <p style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '-8px', marginBottom: '16px', lineHeight: 1.5 }}>
              {tierHint}
            </p>
          )}

          {/* Deposit */}
          <div className="form-group">
            <label>Caution (€) <span style={{ color: 'var(--muted)', fontWeight: '400' }}>— remboursable au retour</span></label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.deposit}
              onChange={set('deposit')}
              placeholder="Calculée automatiquement à 20% de la valeur"
              disabled={isLocked}
            />
          </div>

          {/* Просрочка. Платформа её НЕ считает и НЕ удерживает — это цифра,
              которую владелец объявляет заранее, чтобы при встрече не спорить. */}
          <div className="form-group">
            <label>Retard (€ / jour) <span style={{ color: 'var(--muted)', fontWeight: '400' }}>— optionnel</span></label>
            <input
              type="number"
              min="0.50"
              step="0.50"
              value={form.late_fee_per_day}
              onChange={set('late_fee_per_day')}
              placeholder="ex. 10.00"
              disabled={isLocked}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '5px', lineHeight: 1.5 }}>
              Montant annoncé à l'avance, réglé entre vous à la restitution. RentIt ne le calcule ni ne le prélève.
            </p>
          </div>

          {/* Location */}
          <div className="form-group">
            <label>Localisation</label>
            <input
              value={form.address}
              onChange={set('address')}
              placeholder="Rue, ville (visible par les locataires)"
              disabled={isLocked}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={getLocation}
                className="btn btn-secondary btn-sm"
                disabled={geoLoading || isLocked}
              >
                {geoLoading ? 'Localisation...' : lat ? '✓ Position définie' : '📍 Ma position'}
              </button>
              {lat && (
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {lat.toFixed(4)}, {lng?.toFixed(4)}
                </span>
              )}
            </div>
            {/* Адрес текстом и координаты — разные вещи, и человек об этом не
                догадывается. Поиск «À proximité» отбрасывает вещи без координат
                целиком: объявление просто не появляется, и владелец никогда не
                узнает почему. Раз последствие невидимо — предупреждаем до него. */}
            {lat === null && (
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
                Sans position, votre outil n'apparaîtra pas dans la recherche
                «&nbsp;À proximité&nbsp;» — seulement dans la liste complète.
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="form-group">
            <label>Photos (jusqu'à 5, max 5 Mo chacune)</label>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotos}
              style={{ display: 'none' }}
              disabled={isLocked}
            />

            {/* Custom button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLocked}
              className="btn btn-secondary"
              style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="7" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 3V2.5A1.5 1.5 0 0 1 6.5 1h1A1.5 1.5 0 0 1 9 2.5V3" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''} sélectionnée${photos.length > 1 ? 's' : ''} — changer` : 'Choisir des photos'}
            </button>

            {photoPreviews.length > 0 && (
              <div className="photo-grid" style={{ marginTop: '12px' }}>
                {photoPreviews.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} className="photo-thumb" alt="" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      disabled={isLocked}
                      aria-label="Supprimer la photo"
                      style={{
                        position: 'absolute', top: '2px', right: '2px',
                        background: 'rgba(0,0,0,0.65)', color: '#fff',
                        border: 'none', borderRadius: '50%',
                        width: '20px', height: '20px', fontSize: '13px',
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

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', minHeight: '44px' }}
            disabled={isLocked}
          >
            {uploading
              ? photos.length > 0
                ? `Envoi photo ${uploadProgress}/${photos.length}…`
                : t('publishing')
              : t('publishListing')}
          </button>
        </form>
      </div>
    </div>
  )
}
