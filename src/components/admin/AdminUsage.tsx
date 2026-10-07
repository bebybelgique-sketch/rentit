// src/components/admin/AdminUsage.tsx
//
// Блок «Utilisation» на вкладке «Statistiques» в /admin: дневные счётчики
// (миграция 62) — итог с первого дня, за 7 дней, три доли пути человека и
// отметка «пора пересмотреть первый экран» числом открытий главной.
//
// Рядом с цифрами сказано, кого они описывают: только согласившихся на
// «Analytique». Без этой строки 40 открытий читались бы как «40 человек
// пришло», а пришло больше.

import { useTranslation } from 'react-i18next'
import { useAdminUsage } from '../../hooks/useAdminUsage'
import { errorText } from '../../lib/errorText'
import { formatDay, formatNumber } from '../../domain/dates'
import { FIRST_SCREEN_REVIEW_AT, USAGE_EVENTS, summarizeUsage, type UsageEventName } from '../../domain/usage'

const LABEL: Record<UsageEventName, string> = {
  home_view: 'admin.usage.events.home_view',
  hero_search: 'admin.usage.events.hero_search',
  browse_view: 'admin.usage.events.browse_view',
  browse_empty: 'admin.usage.events.browse_empty',
  demand_sent: 'admin.usage.events.demand_sent',
  listing_start: 'admin.usage.events.listing_start',
}

const cell = { padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }
const head = { ...cell, fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }

export default function AdminUsage({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation()
  const usage = useAdminUsage(enabled)

  if (usage.isLoading) return <div className="loading">{t('common.loading')}</div>
  if (usage.isError) {
    return <div className="error-msg" role="alert">{errorText(t, usage.error, 'admin.usage.loadFailed')}</div>
  }

  const s = summarizeUsage(usage.data ?? [], new Date().toISOString().slice(0, 10))
  const pct = (v: number | null) =>
    v === null ? '—' : formatNumber(v, i18n.language, { style: 'percent', maximumFractionDigits: 0 })
  const since = s.since ? formatDay(s.since, i18n.language, { day: 'numeric', month: 'long' }) : null
  const homeViews = s.total.home_view

  return (
    <section aria-labelledby="admin-usage-title" style={{ marginTop: '24px' }}>
      <h2 id="admin-usage-title" style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>{t('admin.usage.title')}</h2>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: 0 }}>{t('admin.usage.note')}</p>

      {/* Точка пересмотра — числом, а не датой (FIRST_SCREEN_REVIEW_AT). */}
      <p className="card" style={{ padding: '12px 16px', fontWeight: 600 }}>
        {homeViews >= FIRST_SCREEN_REVIEW_AT
          ? t('admin.usage.reviewDue', { count: homeViews })
          : t('admin.usage.review', { count: homeViews, target: FIRST_SCREEN_REVIEW_AT })}
      </p>

      {s.since === null ? (
        <p style={{ color: 'var(--muted)' }}>{t('admin.usage.empty')}</p>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...head, textAlign: 'left' }}>{t('admin.usage.colEvent')}</th>
                  <th scope="col" style={head}>{t('admin.usage.colWeek')}</th>
                  <th scope="col" style={head}>{since ? t('admin.usage.colTotal', { date: since }) : t('admin.usage.colTotalEmpty')}</th>
                </tr>
              </thead>
              <tbody>
                {USAGE_EVENTS.map((e) => (
                  <tr key={e}>
                    <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 500 }}>{t(LABEL[e])}</th>
                    <td style={cell}>{s.last7[e]}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{s.total[e]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '16px 0 8px' }}>{t('admin.usage.ratiosTitle')}</h3>
          <div className="grid grid-3">
            {[
              { label: t('admin.usage.ratioHomeToSearch'), value: pct(s.ratios.homeToSearch) },
              { label: t('admin.usage.ratioBrowseEmpty'), value: pct(s.ratios.browseEmpty) },
              { label: t('admin.usage.ratioEmptyToDemand'), value: pct(s.ratios.emptyToDemand) },
            ].map((r) => (
              <div key={r.label} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>{r.value}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>{r.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
