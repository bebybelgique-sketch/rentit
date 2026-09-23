// src/pages/Activity.tsx
//
// «Activité» — что случилось, пока меня не было.
//
// ── ЗАЧЕМ ────────────────────────────────────────────────────────────
//
// Push живёт в шторке устройства: смахнул — пропало, на ноутбуке его и не
// было. «À faire maintenant» и «Ce qui vous attend» показывают СОСТОЯНИЕ —
// что сделать сейчас, — но не историю. Эта страница — история: заявки,
// ответы, истечения, отмены и сообщения, сгруппированные по дням.
//
// ── КОГДА НЕПРОЧИТАННОЕ СТАНОВИТСЯ ПРОЧИТАННЫМ ───────────────────────
//
// Открыл ленту — прочитал её: через полторы секунды всё отмечается, и
// число у колокольчика гаснет. Но выделение «новое» держится до конца
// ЭТОГО визита — оно снято со снимка, сделанного при загрузке. Иначе
// человек увидел бы, как выделение гаснет у него на глазах, и не понял
// бы, что из этого было новым.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useActivityFeed, useMarkActivityRead } from '../hooks/useActivity'
import { usePageTitle } from '../hooks/usePageTitle'
import { groupByDay, toEntry, type ActivityEntry, type DayGroup } from '../domain/activity'
import { pushLangOf } from '../lib/push'
import { errorText } from '../lib/errorText'
import EmptyState from '../components/common/EmptyState'

/** Сколько смотреть на ленту, прежде чем считать её прочитанной. */
const READ_AFTER_MS = 1500

export default function Activity() {
  const { t, i18n } = useTranslation()
  usePageTitle(t('pageTitle.activity'))
  const { user } = useAuth()
  const feed = useActivityFeed(user?.id)
  const markRead = useMarkActivityRead(user?.id)

  // Снимок «что было новым» при первой загрузке — см. шапку.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string> | null>(null)
  const marked = useRef(false)

  useEffect(() => {
    if (!feed.data || freshIds !== null) return
    setFreshIds(new Set(feed.data.filter((r) => r.read_at === null).map((r) => r.id)))
  }, [feed.data, freshIds])

  useEffect(() => {
    if (!freshIds || freshIds.size === 0 || marked.current) return
    const timer = setTimeout(() => {
      marked.current = true
      markRead.mutate({ all: true })
    }, READ_AFTER_MS)
    return () => clearTimeout(timer)
    // markRead — стабильный объект мутации; повторный запуск не нужен.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshIds])

  const lang = pushLangOf(i18n.language)
  const now = new Date()
  const groupTitle: Record<DayGroup, string> = {
    today: t('activity.today'),
    yesterday: t('activity.yesterday'),
    earlier: t('activity.earlier'),
  }
  const when = (e: ActivityEntry, group: DayGroup) =>
    group === 'earlier'
      ? new Date(e.createdAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
      : new Date(e.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="page">
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>{t('activity.title')}</h1>

        {feed.isLoading && <div className="loading">{t('common.loading')}</div>}
        {feed.isError && <div className="error-msg" role="alert">{errorText(t, feed.error, 'activity.loadFailed')}</div>}

        {feed.data && feed.data.length === 0 && (
          <EmptyState
            title={t('activity.emptyTitle')}
            description={t('activity.emptyBody')}
            actionLabel={t('activity.emptyAction')}
            actionTo="/my-rentals"
          />
        )}

        {feed.data && feed.data.length > 0 && groupByDay(feed.data.map((r) => toEntry(r, lang)), now).map(({ group, entries }) => (
          <section key={group} aria-labelledby={`activity-${group}`} style={{ marginBottom: '24px' }}>
            <h2 id={`activity-${group}`} className="activity-day">{groupTitle[group]}</h2>
            <ul className="activity-list">
              {entries.map((e) => {
                const fresh = freshIds?.has(e.id) ?? e.unread
                return (
                  <li key={e.id}>
                    <Link to={e.href} className={`activity-item${fresh ? ' is-new' : ''}`}>
                      <span className="activity-dot" aria-hidden="true" />
                      <span className="activity-text">
                        <span className="activity-title">
                          {fresh && <span className="visually-hidden">{t('activity.newBadge')} · </span>}
                          {e.title}
                        </span>
                        <span className="activity-body">{e.body}</span>
                      </span>
                      <time className="activity-time" dateTime={e.createdAt}>{when(e, group)}</time>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
