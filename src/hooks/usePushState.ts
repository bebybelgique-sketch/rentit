// src/hooks/usePushState.ts
//
// Состояние уведомлений на этом устройстве для экрана. Выяснение
// запускается при первом использовании и только для вошедшего человека:
// функция push-subscription без входа отвечает 401, и спрашивать её
// раньше незачем.

import { useEffect, useSyncExternalStore } from 'react'
import { getPushSnapshot, probePush, subscribePushState, type PushSnapshot } from '../lib/pushState'

export function usePushState(enabled: boolean): PushSnapshot {
  const snapshot = useSyncExternalStore(subscribePushState, getPushSnapshot, getPushSnapshot)
  useEffect(() => {
    if (enabled && snapshot.phase === 'idle') void probePush()
  }, [enabled, snapshot.phase])
  return snapshot
}
