// src/components/push/PushBlockedBanner.tsx
//
// Полоса C пакета Design — в начале «Locations», когда уведомления
// заблокированы в браузере, а человек как раз ждёт ответа по заявке.
//
// Не упрёк и не просьба: RentIt переспросить не может технически, поэтому
// полоса говорит, где ответ всё равно появится, и как вернуть
// уведомления, если захочется. «Compris» закрывает её навсегда; состояние
// остаётся видно в Профиле.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { usePushState } from '../../hooks/usePushState'
import { shouldShowBlockedBanner } from '../../domain/pushOffer'
import { readOfferMemory, writeOfferMemory } from '../../lib/push'

export default function PushBlockedBanner({ hasPendingRequest }: { hasPendingRequest: boolean }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  // Выяснять состояние стоит только когда есть что ждать: иначе полоса
  // не покажется при любом ответе, а запрос уйдёт впустую.
  const push = usePushState(Boolean(user) && hasPendingRequest)
  const [closed, setClosed] = useState(false)

  if (closed || push.phase !== 'ready') return null
  if (!shouldShowBlockedBanner(push, readOfferMemory(), hasPendingRequest)) return null

  const close = () => {
    writeOfferMemory({ ...readOfferMemory(), blockedBannerDismissed: true })
    setClosed(true)
  }

  return (
    <section className="push-blocked" aria-labelledby="push-blocked-title">
      <h2 id="push-blocked-title" className="push-blocked-title">{t('push.blocked.title')}</h2>
      <p className="push-blocked-text">{t('push.blocked.text')}</p>
      <p className="push-blocked-how">{t('push.blocked.how')}</p>
      <button type="button" className="btn btn-secondary" onClick={close}>{t('push.blocked.ok')}</button>
    </section>
  )
}
