// src/components/admin/AdminErrors.tsx
//
// Вкладка «Erreurs» в /admin: поломки в браузерах людей за 30 дней.
//
// Одна карточка — одна поломка за день (миграция 41 группирует отчёты по
// отпечатку), свежие сверху. Счётчик — первым: сотня падений одной
// поломки и одно падение другой требуют разного внимания, и видно это
// должно быть до чтения текста.

import { useTranslation } from 'react-i18next'
import { useAdminErrors } from '../../hooks/useAdminErrors'
import { errorText } from '../../lib/errorText'

/**
 * Отчёты прогонов (npm run test:edge, замеры в браузере) начинаются с
 * «E2E» — тот же знак, по которому уборка находит тестовые объявления.
 * Проверить приём, не записав строку, нельзя; показывать их тому, кто
 * чинит, — незачем. Через 30 дней они уходят сами, как и всё в таблице.
 */
export const isRehearsal = (message: string): boolean => /^(?:\w+: )?E2E\b/.test(message)

export default function AdminErrors({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation()
  const errors = useAdminErrors(enabled)

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (errors.isLoading) return <div className="loading">{t('common.loading')}</div>
  if (errors.isError) {
    return <div className="error-msg" role="alert">{errorText(t, errors.error, 'admin.errors.loadFailed')}</div>
  }
  const rows = (errors.data ?? []).filter((e) => !isRehearsal(e.message))
  if (!rows.length) {
    return <p style={{ color: 'var(--muted)' }}>{t('admin.errors.empty')}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((e) => (
        <div key={`${e.fingerprint}-${e.day}`} className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="tag tag-red" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('admin.errors.count', { count: e.count })}
            </span>
            <span className="tag tag-gray">{e.kind}</span>
            <strong style={{ flex: '1 1 260px', minWidth: 0, overflowWrap: 'anywhere' }}>{e.message}</strong>
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--muted)', overflowWrap: 'anywhere' }}>
            <code>{e.path}</code>
            {' · '}{t('admin.errors.lastSeen', { date: when(e.last_seen) })}
            {' · '}{t('admin.errors.firstSeen', { date: when(e.first_seen) })}
            {e.release && <>{' · '}{t('admin.errors.release', { release: e.release })}</>}
            {e.lang && <>{' · '}{e.lang.toUpperCase()}</>}
          </div>
          {e.user_agent && (
            <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--text-faint)', overflowWrap: 'anywhere' }}>
              {e.user_agent}
            </div>
          )}
          {e.stack && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '13px' }}>{t('admin.errors.stack')}</summary>
              <pre style={{ margin: '8px 0 0', padding: '10px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius)', fontSize: '12px', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {e.stack}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}
