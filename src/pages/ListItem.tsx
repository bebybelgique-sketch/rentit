import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useBeforeUnload, Link } from 'react-router-dom'
import { t } from '../i18n'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { value: 'power_tools',  label: '⚡ Électroportatif' },
  { value: 'hand_tools',   label: '🔧 Outillage manuel' },
  { value: 'garden',       label: '🌿 Jardinage' },
  { value: 'construction', label: '🏗️ Construction' },
  { value: 'cleaning',     label: '🧹 Nettoyage' },
  { value: 'measuring',    label: '📐 Mesure & Détection' },
]

const CONDITIONS = ['new', 'like_new', 'good', 'fair']
const CONDITIONS_FR: Record<string, string> = {
  new: 'Neuf',
  like_new: 'Comme neuf',
  good: 'Bon état',
  fair: 'Correct',
}

const SUGGESTED_PRICES: Record<string, string> = {
  power_tools:  'Perceuses €10–18 · Meuleuses €12–20 · Scies sauteuses €8–15',
  hand_tools:   'Jeux de marteaux €5–10 · Jeux de clés €6–12',
  garden:       'Tondeuses €20–35 · Débroussailleuses €15–25 · Nettoyeurs HP €25–40',
  construction: 'Échafaudages €30–60 · Bétonnières €25–45 · Compresseurs €20–35',
  cleaning:     'Autolaveuses €25–40 · Nettoyeurs vapeur €15–25',
  measuring:    'Niveaux laser €10–18 · Détecteurs €8–14',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export default function ListItem() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'power_tools',
    condition: 'good',
    price_per_day: '',
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
  const [estimatedValue, setEstimatedValue] = useState('')

  // Check avatar_url — block listing without profile photo
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!form.title.trim())           return setError('Le titre est requis.')
    if (!form.price_per_day || parseFloat(form.price_per_day) <= 0)
                                       return setError('Le prix doit être supérieur à 0.')
    if (parseFloat(form.deposit || '0') < 0)
                                       return setError('La caution ne peut pas être négative.')

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

  if (needsPhoto) return (
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
      <Link to="/profile" className="btn btn-primary" style={{ minHeight: '48px', fontSize: '16px', padding: '14px 32px' }}>
        {t('addPhotoBtn')}
      </Link>
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
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>État *</label>
              <select value={form.condition} onChange={set('condition')} disabled={isLocked}>
                {CONDITIONS.map(c => (
                  <option key={c} value={c}>
                    {CONDITIONS_FR[c] || c}
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
                  {SUGGESTED_PRICES[form.category]}
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
