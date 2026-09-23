// src/hooks/usePushSync.ts
//
// Уведомления на уровне приложения — три обязанности, у которых нет
// своего экрана:
//
// 1. ТИХАЯ ПОДПИСКА. Разрешение браузера уже дано, а сервер этого
//    устройства за вошедшим не знает (новый вход, чистка данных сайта,
//    браузер сменил адрес подписки) — подписать без вопросов. Правило
//    пакета Design. Выключившего в Профиле не трогаем.
// 2. ЯЗЫК. Переключил язык — уведомления на этом устройстве пойдут на
//    новом: текст собирает сервер, и язык он берёт из подписки.
// 3. ПЕРЕХОД ПО НАЖАТИЮ. Воркер просит открытую вкладку перейти к брони
//    (сообщение 'rentit:navigate') — переходим внутри приложения, без
//    перезагрузки.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { activityKeys } from '../lib/queryKeys'
import i18n from '../i18n-next'
import { pushLangOf, readOfferMemory, readPermission, syncDeviceLanguage } from '../lib/push'
import { getPushSnapshot, probePush, resetPushState, subscribeSilently } from '../lib/pushState'

export function usePushSync(userId: string | null): void {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 1. Вход и выход.
  useEffect(() => {
    if (!userId) {
      resetPushState()
      return
    }
    // Без разрешения делать нечего — и ни одного запроса к серверу.
    if (readPermission() !== 'granted' || readOfferMemory().optedOut) return
    let cancelled = false
    void probePush().then(() => {
      const s = getPushSnapshot()
      if (cancelled || s.capability !== 'supported' || !s.configured || s.subscribed) return
      void subscribeSilently(pushLangOf(i18n.language))
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // 2. Язык.
  useEffect(() => {
    if (!userId) return
    const onChange = (lang: string) => {
      if (!getPushSnapshot().subscribed) return
      syncDeviceLanguage(pushLangOf(lang)).catch((e) => console.warn('[push] язык не записан:', e))
    }
    i18n.on('languageChanged', onChange)
    return () => {
      i18n.off('languageChanged', onChange)
    }
  }, [userId])

  // 3. Переход по нажатию на уведомление.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null
      // 4. Пришёл push — лента и колокольчик обновляются сразу.
      if (data?.type === 'rentit:activity') {
        void queryClient.invalidateQueries({ queryKey: activityKeys.all })
        return
      }
      if (data?.type !== 'rentit:navigate' || typeof data.url !== 'string') return
      // Только свой путь — так же, как проверяет воркер.
      if (!data.url.startsWith('/') || data.url.startsWith('//')) return
      navigate(data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate, queryClient])
}
