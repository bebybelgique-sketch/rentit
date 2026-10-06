import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { money } from '../../domain/push'
import { weekendLabel } from '../../domain/weekend'

/** Поле калькулятора → число в границах; мусор и пустота — ноль. */
const bounded = (raw: string, max: number): number => {
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
}

/**
 * Блок для владельца: что он решает сам, сколько это может дать, и как
 * выглядит заявка у него на экране.
 *
 * Калькулятор — арифметика человека, а не наше обещание: цену и число дней
 * вводит он. По умолчанию 12 € × 2 дня — одни выходные в месяц, скромно
 * намеренно: любое большее число читалось бы как замер спроса, которого нет.
 *
 * Карточка справа подписана «Aperçu de votre écran»: это иллюстрация
 * интерфейса, а не чья-то настоящая заявка. Даты в ней — ближайшие
 * выходные, посчитанные сегодня.
 */
export default function OwnerSection() {
  const { t, i18n } = useTranslation()
  const [price, setPrice] = useState('12')
  const [days, setDays] = useState('2')
  const total = Math.round(bounded(price, 9999) * bounded(days, 31) * 100) / 100

  const points = [
    [t('landing.owner1Strong'), t('landing.owner1Rest')],
    [t('landing.owner2Strong'), t('landing.owner2Rest')],
    [t('landing.owner3Strong'), t('landing.owner3Rest')],
  ]

  return (
    <section className="lp-sec" aria-labelledby="lp-owner-title">
      <div className="lp-wrap">
        <div className="lp-owner">
          <div className="lp-owner-txt">
            <p className="lp-kicker">{t('landing.ownerKicker')}</p>
            <h2 id="lp-owner-title" className="lp-h2">{t('landing.ownerTitle')}</h2>
            <ul className="lp-owner-points">
              {points.map(([strong, rest]) => (
                <li key={strong}>
                  <span className="lp-tick" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                  <span><b>{strong}</b> {rest}</span>
                </li>
              ))}
            </ul>

            <div className="lp-calc">
              <label>
                {t('landing.calcPrice')}
                <span>
                  <input type="number" inputMode="decimal" min={0} max={9999} step={1}
                    value={price} onChange={e => setPrice(e.target.value)} />
                  €
                </span>
              </label>
              <span className="lp-calc-op" aria-hidden="true">×</span>
              <label>
                {t('landing.calcDays')}
                <span>
                  <input type="number" inputMode="numeric" min={0} max={31} step={1}
                    value={days} onChange={e => setDays(e.target.value)} />
                </span>
              </label>
              <span className="lp-calc-op" aria-hidden="true">=</span>
              <output className="lp-calc-res" aria-live="polite">
                <b>{money(total)}</b>
                <small>{t('landing.calcResult')}</small>
              </output>
            </div>

            <Link to="/list-item" className="lp-btn lp-btn-do lp-btn-pill">
              {t('landing.ownerCta')}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>

          <div className="lp-owner-art" aria-hidden="true">
            <img src="/owner-workbench.jpg" alt="" width={960} height={641} loading="lazy" decoding="async" />
            <div className="lp-req">
              <span className="lp-ex">{t('landing.ownerPreview')}</span>
              <div className="lp-req-top">
                <div>
                  <b>{t('landing.ownerPreviewTitle')}</b>
                  <span>{weekendLabel(new Date(), i18n.language)} · {money(24)}</span>
                </div>
                <span className="lp-req-badge">1</span>
              </div>
              <div className="lp-req-btns">
                <span>{t('reject')}</span>
                <span className="is-do">{t('approve')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
