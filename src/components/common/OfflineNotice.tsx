import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Полоса «нет сети».
 *
 * ── ЗАЧЕМ ────────────────────────────────────────────────────────────
 *
 * С воркером приложение без сети ОТКРЫВАЕТСЯ — и этим создаёт новую
 * ложь: экран выглядит рабочим, но заявка не уйдёт, а список показывает
 * то, что успело приехать раньше. Человек нажимает и не понимает, почему
 * ничего не происходит.
 *
 * Разница между «сломалось» и «нет сети» — единственное, что ему сейчас
 * нужно знать, и сказать это обязан продукт, а не догадка.
 *
 * ── ПОЧЕМУ НЕ ТОСТ ───────────────────────────────────────────────────
 *
 * Тост исчезает, а состояние — нет. Полоса висит ровно столько, сколько
 * длится причина, и уходит сама, когда сеть вернулась: человеку не надо
 * гадать, всё ли ещё он офлайн.
 *
 * ── ЧЕГО ЭТА ПОЛОСА НЕ ДЕЛАЕТ ────────────────────────────────────────
 *
 * `navigator.onLine` отвечает на вопрос «есть ли у устройства
 * подключение», а не «доходит ли до нашего сервера». В кафе с
 * неоплаченным Wi-Fi он скажет «сеть есть». Врать он может только в одну
 * сторону — показать сеть там, где её нет; обратного не бывает. Поэтому
 * полоса не появляется зря, но может не появиться, когда стоило бы. Для
 * второго случая есть обычные ошибки запросов.
 */
export default function OfflineNotice() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="offline-notice"
      // `status`, а не `alert`: сообщение важное, но не срочное —
      // `alert` перебивает то, что человек слушает сейчас.
      role="status"
      aria-live="polite"
    >
      {t('offline.notice')}
    </div>
  )
}
