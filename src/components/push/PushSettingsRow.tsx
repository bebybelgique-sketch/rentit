// src/components/push/PushSettingsRow.tsx
//
// Строка «Notifications» в Профиле — F пакета Design. Единственное место,
// где уведомления можно включить без повода и выключить вообще: карточки
// после двух «не сейчас» молчат, а строка остаётся всегда.
//
//   off      «Désactivées sur cet appareil» + «Activer»
//   on       «Activées sur cet appareil» + «Désactiver»
//   blocked  только объяснение: переспросить браузер нельзя
//   install  только объяснение: iPhone не с экрана «Домой»
//   hidden   push здесь нет или канал не заведён — строки нет вовсе
//
// «Désactiver» снимает подписку, а разрешение браузера остаётся; поэтому
// «Activer» после него включает без повторного окна браузера.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { usePushState } from '../../hooks/usePushState'
import { profileRowState } from '../../domain/pushOffer'
import { serverErrorKey } from '../../domain/serverErrors'
import { EdgeError } from '../../lib/edgeInvoke'
import { pushLangOf } from '../../lib/push'
import { disablePush, enablePush } from '../../lib/pushState'

export default function PushSettingsRow() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const push = usePushState(Boolean(user))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (push.phase !== 'ready') return null
  const state = profileRowState(push)
  if (state === 'hidden') return null

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      console.error('[push] профиль:', e)
      setError(serverErrorKey(e instanceof EdgeError ? e.code : null))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ marginTop: 'var(--space-6)' }} aria-labelledby="push-row-title">
      <h2 id="push-row-title" style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>
        {t('push.row.title')}
      </h2>
      <div className="push-row">
        {state === 'off' || state === 'on' ? (
          <>
            <span className={state === 'on' ? 'push-row-status push-row-status--on' : 'push-row-status'}>
              {state === 'on' ? t('push.row.on') : t('push.row.off')}
            </span>
            {state === 'on' ? (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(disablePush)}>
                {t('push.row.disable')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => run(() => enablePush(pushLangOf(i18n.language)))}
              >
                {t('push.row.enable')}
              </button>
            )}
          </>
        ) : (
          <span className="push-row-status">{state === 'blocked' ? t('push.row.blocked') : t('push.row.install')}</span>
        )}
      </div>
      {error && <div className="error-msg" role="alert" style={{ marginTop: '8px' }}>{t(error)}</div>}
    </section>
  )
}
