// src/components/ItemBlackouts.tsx
//
// Перерывы владельца: недели, когда вещь не сдаётся, хотя объявление
// висит.
//
// До 17.08 у владельца было ровно два состояния: «сдаю всегда» и
// «объявление скрыто целиком». Уехать на неделю, не снимая объявление,
// было нельзя — и человек снимал его, а потом забывал вернуть. Для
// площадки с нулём предложения снятое объявление стоит дороже всего.
//
// Блок живёт ВНЕ формы редактирования и сохраняется сам: вкладывать форму
// в форму нельзя, а держать перерывы до нажатия «Сохранить» — значит
// потерять их при первой же ошибке в другом поле.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { toISODate } from '../domain/availability'
import type { ItemBlackout } from '../types'

export default function ItemBlackouts({ itemId }: { itemId: string }) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<ItemBlackout[]>([])
  const [loading, setLoading] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const today = toISODate(new Date())

  const load = async () => {
    const { data, error: err } = await supabase
      .from('item_blackouts')
      .select('*')
      .eq('item_id', itemId)
      .order('start_date', { ascending: true })
    if (err) setError(err.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [itemId]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    setError('')
    if (!start || !end) return setError(t('blackouts.datesRequired'))
    if (end < start) return setError(t('blackouts.endBeforeStart'))
    setBusy(true)
    const { error: err } = await supabase.from('item_blackouts').insert([{
      item_id: itemId,
      start_date: start,
      end_date: end,
      note: note.trim() || null,
    }])
    setBusy(false)
    if (err) return setError(err.message)
    setStart(''); setEnd(''); setNote('')
    load()
  }

  const remove = async (id: string) => {
    setBusy(true)
    const { error: err } = await supabase.from('item_blackouts').delete().eq('id', id)
    setBusy(false)
    if (err) return setError(err.message)
    load()
  }

  const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(i18n.language)

  return (
    <section className="card" style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-2)' }}>
        {t('blackouts.title')}
      </h2>
      <p className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>{t('blackouts.intro')}</p>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <p className="form-hint">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="form-hint">{t('blackouts.empty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
          {rows.map(r => (
            <li key={r.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 'var(--space-3)', padding: 'var(--space-3) 0',
              borderTop: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                  {r.start_date === r.end_date ? fmt(r.start_date) : `${fmt(r.start_date)} — ${fmt(r.end_date)}`}
                </div>
                {r.note && <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{r.note}</div>}
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={busy}
                className="btn btn-secondary"
                style={{ minHeight: '40px' }}
              >
                {t('blackouts.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="form-group">
          <label htmlFor="blackout-start">{t('blackouts.from')}</label>
          <input id="blackout-start" type="date" min={today} value={start}
                 onChange={e => setStart(e.target.value)} disabled={busy} />
        </div>
        <div className="form-group">
          <label htmlFor="blackout-end">{t('blackouts.to')}</label>
          <input id="blackout-end" type="date" min={start || today} value={end}
                 onChange={e => setEnd(e.target.value)} disabled={busy} />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="blackout-note">
          {t('blackouts.noteLabel')}{' '}
          <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('common.optional')}</span>
        </label>
        <input id="blackout-note" value={note} maxLength={200}
               onChange={e => setNote(e.target.value)} disabled={busy} />
        <p className="form-hint">{t('blackouts.notePrivate')}</p>
      </div>

      <button type="button" onClick={add} disabled={busy} className="btn btn-secondary" style={{ minHeight: '44px' }}>
        {t('blackouts.add')}
      </button>
    </section>
  )
}
