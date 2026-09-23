// src/components/push/PushOfferCard.tsx
//
// Предложение уведомлений на поводе — карточки A, B и D пакета Design.
//
//   A  trigger="request"  арендатор только что отправил заявку
//   B  trigger="publish"  владелец только что выставил вещь
//   D  iPhone не с экрана «Домой» — вместо A/B объяснение, как добавить
//
// Решение, показывать ли, принимается ОДИН раз, когда состояние
// устройства выяснено, и дальше не пересматривается: после «Pas
// maintenant» карточка обязана свернуться в строку «D'accord…», а не
// исчезнуть — пересчёт решения убрал бы её вместе со строкой.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { usePushState } from '../../hooks/usePushState'
import { decideOffer, recordDismissal } from '../../domain/pushOffer'
import { serverErrorKey } from '../../domain/serverErrors'
import { EdgeError } from '../../lib/edgeInvoke'
import { pushLangOf, readOfferMemory, writeOfferMemory } from '../../lib/push'
import { enablePush, subscribeSilently } from '../../lib/pushState'

type Phase = 'deciding' | 'hidden' | 'ask' | 'install' | 'busy' | 'granted' | 'declined' | 'failed'

interface Props {
  trigger: 'request' | 'publish'
  /** Имя владельца для карточки A: «Savoir quand Ramzan répond ?». */
  ownerFirstName?: string | null
}

export default function PushOfferCard({ trigger, ownerFirstName }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const push = usePushState(Boolean(user))
  const [phase, setPhase] = useState<Phase>('deciding')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const decided = useRef(false)

  useEffect(() => {
    if (decided.current || push.phase !== 'ready') return
    decided.current = true
    const decision = decideOffer(push, readOfferMemory(), Date.now())
    if (decision === 'ask') setPhase('ask')
    else if (decision === 'install') setPhase('install')
    else {
      setPhase('hidden')
      if (decision === 'subscribe-silently') void subscribeSilently(pushLangOf(i18n.language))
    }
  }, [push, i18n.language])

  const dismiss = () => {
    writeOfferMemory(recordDismissal(readOfferMemory(), Date.now()))
    setPhase('declined')
  }

  const accept = async () => {
    setPhase('busy')
    setErrorCode(null)
    try {
      const outcome = await enablePush(pushLangOf(i18n.language))
      if (outcome === 'granted') setPhase('granted')
      // Закрыл окно браузера, не ответив, — для нас это «не сейчас»:
      // Chrome сам считает такие закрытия и после трёх блокирует вопрос.
      else if (outcome === 'dismissed') dismiss()
      // Отказ в окне браузера: та же строка, что «Pas maintenant» (пакет),
      // дальше о состоянии говорит полоса в «Locations».
      else setPhase('declined')
    } catch (error) {
      console.error('[push] подписка не удалась:', error)
      setErrorCode(error instanceof EdgeError ? error.code : null)
      setPhase('failed')
    }
  }

  if (phase === 'deciding' || phase === 'hidden') return null

  const tab = t('nav.bookings')

  if (phase === 'granted') {
    return <p className="push-line" role="status">{t('push.offer.granted')}</p>
  }
  if (phase === 'declined') {
    return (
      <p className="push-line" role="status">
        {trigger === 'request'
          ? t('push.offer.declinedRequest', { tab })
          : t('push.offer.declinedPublish', { tab })}
      </p>
    )
  }
  if (phase === 'failed') {
    return <p className="push-line push-line--error" role="alert">{t(serverErrorKey(errorCode))}</p>
  }

  const owner = ownerFirstName?.trim() || t('push.offer.ownerFallback')
  const title = trigger === 'request'
    ? t('push.offer.requestTitle', { owner })
    : t('push.offer.publishTitle')

  if (phase === 'install') {
    return (
      <section className="push-offer" aria-labelledby="push-offer-title">
        <h3 id="push-offer-title" className="push-offer-title">{title}</h3>
        <p className="push-offer-body">{t('push.install.text')}</p>
        <ol className="push-offer-steps">
          <li>{t('push.install.step1Before')}<strong>{t('push.install.step1Strong')}</strong>{t('push.install.step1After')}</li>
          <li>{t('push.install.step2Before')}<strong>{t('push.install.step2Strong')}</strong>{t('push.install.step2After')}</li>
          <li>{t('push.install.step3')}</li>
        </ol>
        {/* Кнопки «Me prévenir» здесь нет: вне экрана «Домой» она не
            смогла бы ничего сделать (пакет, карточка D). */}
        <button type="button" className="btn btn-secondary push-offer-wide" onClick={dismiss}>
          {t('push.install.later')}
        </button>
      </section>
    )
  }

  return (
    <section className="push-offer" aria-labelledby="push-offer-title">
      <h3 id="push-offer-title" className="push-offer-title">{title}</h3>
      <p className="push-offer-body">
        {trigger === 'request' ? t('push.offer.requestBody', { owner }) : t('push.offer.publishBody')}
      </p>
      <div className="push-offer-actions">
        <button type="button" className="btn btn-primary push-offer-main" onClick={accept} disabled={phase === 'busy'}>
          {t('push.offer.accept')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={dismiss} disabled={phase === 'busy'}>
          {t('push.offer.notNow')}
        </button>
      </div>
    </section>
  )
}
