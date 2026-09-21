import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Consent = { necessary: true; functional: boolean; analytics: boolean }

const STORAGE_KEY = 'rentit_cookie_consent'

/**
 * Что в окне можно взять фокусом.
 *
 * Вынесено в константу не только ради порядка: строкой внутри вызова
 * её принял за текст интерфейса страж вшитых подписей
 * (check-hardcoded-text). Заглушать его списком было бы неверно —
 * список для настоящих исключений, а лишняя запись в нём делает
 * сторожа шумным, и однажды шум перестанут читать.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Согласие и отказ рисуются ОДНИМ объектом стиля, а не двумя похожими.
//
// ЗАЧЕМ ИМЕННО ТАК. Раньше это были две разные кнопки, и «Refuser les
// optionnels» проигрывала «Accepter tous les cookies» по КАЖДОЙ оси сразу:
// заливка против прозрачного, #F5F4F0 против #555 на белом, рамки не было
// против самой бледной #ddd, 14px против 13px, отступ 14 против 11, жирность
// 700 против неустановленной, вся ширина против половины второго ряда.
// Отказ оказывался слабее даже «Gérer les préférences» — то есть самым
// незаметным органом на экране.
//
// Это не вкусовщина. Неравная заметность согласия и отказа — то самое
// оформление, за которое CNIL в январе 2022 оштрафовала Google и Facebook
// на 150 и 60 млн евро, и которое EDPB разбирает в руководстве 03/2022 о
// вводящем в заблуждение оформлении. А в шапке этого же баннера написано
// «CONFORME RGPD»: интерфейс подрывал ровно то, что утверждал текст над ним.
//
// Один объект вместо двух — чтобы равенство держалось СТРОЙКОЙ, а не
// вниманием: сделать одну кнопку заметнее другой теперь нельзя, не разломав
// общий стиль. Текст согласия, набор категорий и сама логика хранения не
// тронуты — изменена только заметность.
const CONSENT_BUTTON: CSSProperties = {
  flex: 1,
  background: '#080808', color: '#F5F4F0',
  border: 'none', borderRadius: '3px',
  padding: '14px 10px', fontSize: '14px', fontWeight: 700,
  cursor: 'pointer', letterSpacing: '-0.01em', lineHeight: 1.25,
}

// «Настройки» — не выбор по существу, а обход: третья кнопка и должна
// читаться третьей. Прежде она была заметнее отказа.
const MANAGE_BUTTON: CSSProperties = {
  width: '100%',
  background: 'transparent', color: '#080808',
  border: '1.5px solid #b8b6b0', borderRadius: '3px',
  padding: '11px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', letterSpacing: '-0.01em',
}

export default function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [functional, setFunctional] = useState(true)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const save = (consent: Consent) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)) } catch { /* blocked */ }
    setVisible(false)
  }

  /**
   * Окно ведёт себя как диалог, а не как кусок страницы.
   *
   * ЧТО БЫЛО ЗАМЕРЕНО. Фокус при открытии оставался на body, обход Tab
   * шёл по навигации ЗА окном (шесть остановок), Escape не закрывал.
   * Для программы чтения окно ничем не отличалось от текста страницы.
   *
   * ПОЧЕМУ ЭТО ВАЖНЕЕ ОБЫЧНОГО. Это первый экран каждого посетителя и
   * юридический гейт: согласие, до которого нельзя добраться, согласием
   * не является.
   */
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const node = dialogRef.current
    if (!node) return

    // Откуда пришли — туда и вернём фокус при закрытии. Иначе человек
    // после выбора оказывается в начале страницы и идёт по навигации
    // заново.
    const returnTo = document.activeElement as HTMLElement | null

    /**
     * Что в окне можно взять фокусом.
     *
     * ФИЛЬТРА ПО ВИДИМОСТИ ЗДЕСЬ НЕТ, И ЭТО НАРОЧНО. Первая версия
     * отсеивала по `offsetParent !== null` — приём разумный на вид и
     * коварный по сути: `offsetParent` требует РАСКЛАДКИ, а там, где
     * её нет, он равен null у всего подряд. Ловушка фокуса тогда
     * молча превращается в пустышку — отфильтровано всё, кольцу не из
     * чего строиться. Поймал это набор: он считает разметку без
     * раскладки, и фокус никуда не встал.
     *
     * Фильтр и не нужен: окно не прячет содержимое стилями, а
     * ПОДМЕНЯЕТ разметку (`!expanded ? … : …`). Невидимых пунктов в
     * нём нет по построению.
     */
    const focusable = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]

    // Фокус — на первый пункт ВНУТРИ окна, а не на само окно. По
    // разметке это ссылка на политику конфиденциальности, и порядок
    // выходит верный: человек слышит заголовок, потом объяснение,
    // потом выбор. Замер подтверждает: «Politique de confidentialité»,
    // inside: true.
    focusable()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape = «отказаться от необязательных». Не «принять всё»:
        // молчание согласием не является. И не «ничего не делать»:
        // окно, из которого нельзя выйти клавиатурой, — ловушка.
        // Выбор тот же, что у кнопки на экране рядом, и он записывается
        // явно, а не подразумевается.
        e.preventDefault()
        rejectAll()
        return
      }
      if (e.key !== 'Tab') return

      // Кольцо: Tab с последнего ведёт на первый, Shift+Tab наоборот.
      // Без этого обход уходит на страницу под окном.
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      returnTo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, expanded])

  const acceptAll = () => save({ necessary: true, functional: true, analytics: true })
  const rejectAll = () => save({ necessary: true, functional: false, analytics: false })
  const saveCustom = () => save({ necessary: true, functional, analytics })

  if (!visible) return null

  return (
    <>
      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'center',
        padding: '0 16px 16px',
        pointerEvents: 'none',
      }}>
        {/* Диалог. role + aria-modal сообщают программе чтения, что
            открылось окно и остальная страница на время недоступна;
            aria-labelledby даёт ему имя — без него оно объявляется как
            «диалог» и ничего больше. */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-dialog-title"
          style={{
          background: '#fff',
          borderRadius: '4px 4px 0 0',
          width: '100%', maxWidth: '520px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          fontFamily: 'var(--font-sans)',
          overflow: 'hidden',
          pointerEvents: 'all',
        }}>

          {/* Top accent bar */}
          <div style={{ height: '3px', background: '#080808' }} />

          <div style={{ padding: '32px' }}>
            {!expanded ? (
              <>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {t('cookies.header')}
                    </div>
                    <h2 id="cookie-dialog-title" style={{ fontSize: '22px', fontWeight: '800', color: '#080808', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>
                      {t('cookies.title')}
                    </h2>
                  </div>
                  <span style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.03em', color: '#080808', flexShrink: 0, marginLeft: '16px', paddingTop: '18px' }}>
                    {/* Вторая половина имени была лаймовой (#ADFF2F с чёрной
                        обводкой) — старая палитра, снятая 12.08. Пережила замену,
                        потому что живёт инлайн-стилем, а не переменной.
                        Результат виден на первом же экране каждого посетителя:
                        в шапке то же имя жёлтое, здесь зелёное. Два фирменных
                        цвета на одном экране, в двухстах пикселях друг от друга.
                        Обводка снята вместе с цветом: она существовала только
                        чтобы лайм читался на белом.
                        Красный, а не сигнальный жёлтый: в продукте знак уже
                        различает фон — на тёмном он жёлтый (навбар), на светлом
                        красный (Landing.tsx). Фон баннера белый, и жёлтый на нём
                        нечитаем. Это следование заведённому правилу, а не новое. */}
                    Rent<span style={{ color: 'var(--action)' }}>It</span>
                  </span>
                </div>

                <p style={{ fontSize: '14px', color: '#555', marginBottom: '20px', lineHeight: 1.65 }}>
                  {t('cookies.lede')}{' '}
                  <Link to="/privacy" style={{ color: '#080808', fontWeight: '600', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                    {t('cookies.privacyLink')}
                  </Link>
                </p>

                {/* Cookie table */}
                <div style={{ border: '1px solid #e8e6e0', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 14px', background: '#F5F4F0', borderBottom: '1px solid #e8e6e0' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('cookies.table.type')}</span>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('cookies.table.status')}</span>
                  </div>
                  {[
                    { label: t('cookies.types.necessary.label'), desc: t('cookies.types.necessary.desc'), required: true },
                    { label: t('cookies.types.functional.label'), desc: t('cookies.types.functional.desc'), required: true },
                    { label: t('cookies.types.analytics.label'), desc: t('cookies.types.analytics.desc'), required: false },
                  ].map((row, i) => (
                    <div key={row.label} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto',
                      padding: '11px 14px', alignItems: 'center',
                      borderBottom: i < 2 ? '1px solid #f0ede8' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#080808' }}>{row.label}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>{row.desc}</div>
                      </div>
                      <span style={{
                        fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: '2px',
                        background: row.required ? 'rgba(8,8,8,0.07)' : 'rgba(8,8,8,0.04)',
                        color: row.required ? '#444' : '#999',
                        border: `1px solid ${row.required ? '#d0cec8' : '#e8e6e0'}`,
                      }}>
                        {row.required ? t('cookies.labels.required') : t('cookies.labels.optional')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Кнопки первого слоя. Согласие и отказ — в одном ряду и одним
                    стилем; «настройки» уходят ниже отдельной строкой. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={acceptAll} style={CONSENT_BUTTON}>
                      {t('cookies.buttons.acceptAll')}
                    </button>
                    <button onClick={rejectAll} style={CONSENT_BUTTON}>
                      {t('cookies.buttons.declineOptional')}
                    </button>
                  </div>
                  <button onClick={() => setExpanded(true)} style={MANAGE_BUTTON}>
                    {t('cookies.buttons.managePreferences')}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Preferences header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {t('cookies.preferences.header')}
                  </div>
                  <button onClick={() => setExpanded(false)} style={{
                    background: 'none', border: 'none', fontSize: '20px',
                    color: '#aaa', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
                  }}>←</button>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#080808', letterSpacing: '-0.03em', marginBottom: '20px' }}>
                  {t('cookies.preferences.title')}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid #e8e6e0', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
                  {[
                    { label: t('cookies.types.necessary.label'), desc: t('cookies.types.necessary.desc'), checked: true, disabled: true, onChange: undefined },
                    { label: t('cookies.types.functional.label'), desc: t('cookies.types.functional.desc'), checked: functional, disabled: false, onChange: setFunctional },
                    { label: t('cookies.types.analytics.label'), desc: t('cookies.types.analytics.desc'), checked: analytics, disabled: false, onChange: setAnalytics },
                  ].map((row, i) => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: '16px', padding: '16px',
                      borderBottom: i < 2 ? '1px solid #f0ede8' : 'none',
                      background: row.disabled ? '#fafaf8' : '#fff',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#080808' }}>{row.label}</span>
                          {row.disabled && (
                            <span style={{
                              fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                              background: 'rgba(8,8,8,0.07)', color: '#666',
                              padding: '2px 6px', borderRadius: '2px', border: '1px solid #d0cec8',
                            }}>{t('cookies.labels.alwaysOn')}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>{row.desc}</div>
                      </div>
                      <Toggle checked={row.checked} onChange={row.onChange} disabled={row.disabled} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={rejectAll} style={{
                    flex: 1, background: 'transparent', color: '#555',
                    border: '1.5px solid #ddd', borderRadius: '3px',
                    padding: '11px', fontSize: '13px', cursor: 'pointer',
                  }}>
                    {t('cookies.buttons.declineOptional')}
                  </button>
                  <button onClick={saveCustom} style={{
                    flex: 1, background: '#080808', color: '#F5F4F0',
                    border: 'none', borderRadius: '3px',
                    padding: '11px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  }}>
                    {t('cookies.buttons.savePreferences')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px',
        background: checked ? '#080808' : '#ddd',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-pressed={checked}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: checked ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}
