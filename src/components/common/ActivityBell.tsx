// src/components/common/ActivityBell.tsx
//
// Колокольчик в шапке: ход в ленту событий и число непрочитанного.
//
// Стоит ВНЕ сворачиваемого меню: на телефоне меню спрятано за бургером, а
// число непрочитанного, спрятанное туда же, не увидит никто. Значок числа —
// тот же, что у дел (TaskBadge): красный значит «ждёт хода», ноль не
// показывается вовсе.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useUnreadActivity } from '../../hooks/useActivity'
import TaskBadge from './TaskBadge'

export default function ActivityBell({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const unread = useUnreadActivity(user?.id)
  if (!user) return null

  const count = unread.data?.count ?? 0

  return (
    <Link
      to="/activity"
      className="activity-bell"
      onClick={onNavigate}
      aria-label={count > 0 ? `${t('nav.activity')} — ${t('activity.unreadLabel', { count })}` : t('nav.activity')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <TaskBadge count={count} placement="tab" label={t('activity.unreadLabel', { count })} />
    </Link>
  )
}
