import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { countUsage } from '../lib/usage'
import { openCookiePreferences } from '../lib/consent'
import HeroSection from '../components/landing/HeroSection'
import LatestListings from '../components/landing/LatestListings'
import OwnerSection from '../components/landing/OwnerSection'
import { useDefaultPageTitle } from '../hooks/usePageTitle'
import { weekendLabel } from '../domain/weekend'

/**
 * Лендинг.
 *
 * С 05–06.10 страница собрана по макету Atelier v2 (холст Claude Design):
 * поиск первым экраном, лента настоящих объявлений, три шага с мини-экранами,
 * блок для владельца с калькулятором, «что вас защищает» и ограничения одной
 * строкой. Почему поиск снова первый — в шапке HeroSection.tsx.
 *
 * Что сохранено из решений 12.08:
 * — палитра: красный, жёлтый, чёрный, серебро; лайм и Syne + DM Mono не
 *   возвращать;
 * — один словарь: все строки в landing.* во всех трёх языках;
 * — никакого своего <style>: страница живёт на токенах src/index.css.
 *
 * Снято 06.10 и почему:
 * — шесть плиток категорий: их работу делают чипы задач на первом экране,
 *   и это те же шесть категорий каталога;
 * — блок «Vous cherchez, vous ne déposez pas ?» и финальная тёмная полоса:
 *   первый экран и так обращён к ищущему, а владелец получил свой блок;
 * — большая табличка ограничений: ограничения остались, но одной строкой
 *   ПОСЛЕ того, что защищает, — порядок, который просили ревью GLM и GPT:
 *   «pas d’assurance» без слоя доверия отпугивает раньше, чем объясняет.
 *
 * Снято раньше и НЕ возвращать без довода:
 * — бегущая строка с десятью типами инструментов по-английски: она
 *   читалась как ассортимент, которого нет;
 * — панель «Revenus par location»: на 390px резала текст до «Gratui» и
 *   «Annonc», а сравнивать в ней было нечего;
 * — мёртвая светлая тема.
 */
export default function Landing() {
  const { t, i18n } = useTranslation()
  // Вход оставляет заголовок из index.html — тот, что написан для
  // поисковика и для превью. Завести здесь вторую копию той же
  // маркетинговой строки значило бы развести их при первой же правке.
  useDefaultPageTitle()

  // Открытие главной — знаменатель всего остального (src/lib/usage.ts).
  useEffect(() => { countUsage('home_view') }, [])

  const weekend = weekendLabel(new Date(), i18n.language)

  return (
    <div>
      <HeroSection />
      <LatestListings />

      {/* Три шага арендатора. Мини-экраны — иллюстрации интерфейса, а не
          данные: в них нет ни чужих объявлений, ни цен. */}
      <section className="lp-sec" aria-labelledby="lp-steps-title">
        <div className="lp-wrap">
          <h2 id="lp-steps-title" className="lp-h2">{t('landing.stepsTitle')}</h2>
          <ol className="lp-steps">
            <li className="lp-step">
              <div className="lp-vig" aria-hidden="true">
                <div className="lp-vig-search">
                  <span>{t('landing.vigWhat')}</span>
                  <span>{t('landing.vigWhere')}</span>
                  <span>{t('landing.whenThis')}</span>
                  <i />
                </div>
              </div>
              <div>
                <span className="lp-step-n">1</span>
                <h3>{t('landing.step1Title')}</h3>
                <p>{t('landing.step1Body')}</p>
              </div>
            </li>
            <li className="lp-step">
              <div className="lp-vig" aria-hidden="true">
                <div className="lp-vig-row">
                  <span>{weekend}</span>
                  <b>{t('landing.vigDays', { count: 2 })}</b>
                </div>
                <span className="lp-vig-btn">{t('landing.vigRequest')}</span>
              </div>
              <div>
                <span className="lp-step-n">2</span>
                <h3>{t('landing.step2Title')}</h3>
                <p>{t('landing.step2Body')}</p>
              </div>
            </li>
            <li className="lp-step">
              <div className="lp-vig" aria-hidden="true">
                {[t('landing.vigCheck1'), t('landing.vigCheck2'), t('landing.vigCheck3')].map(line => (
                  <div key={line} className="lp-vig-check">
                    <span className="lp-tick">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>
                    {line}
                  </div>
                ))}
              </div>
              <div>
                <span className="lp-step-n">3</span>
                <h3>{t('landing.step3Title')}</h3>
                <p>{t('landing.step3Body')}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <OwnerSection />

      {/* Сначала то, что защищает, потом — чего RentIt не делает. Ограничения
          не спрятаны: та же страница, тот же кегль, что у текста рядом. */}
      <section className="lp-sec" aria-labelledby="lp-protect-title">
        <div className="lp-wrap">
          <div className="lp-protect">
            <h2 id="lp-protect-title">{t('landing.protectTitle')}</h2>
            <ProtectRule icon="deposit" title={t('landing.protect1Title')} body={t('landing.protect1Body')} />
            <ProtectRule icon="photo" title={t('landing.protect2Title')} body={t('landing.protect2Body')} />
            <ProtectRule icon="choice" title={t('landing.protect3Title')} body={t('landing.protect3Body')} />
          </div>
          <p className="lp-limits">{t('landing.limitsLine')}</p>
        </div>
      </section>

      <div className="lp-wrap">
        <footer className="lp-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '21px', letterSpacing: '-0.03em' }}>
              Rent<span style={{ color: 'var(--action)' }}>It</span>
            </span>
            <span style={{ fontFamily: 'var(--font-text)', fontSize: '14px', color: 'var(--text-faint)' }}>
              {t('landing.footerCountry')} · {new Date().getFullYear()}
            </span>
          </div>
          <div className="lp-foot-l">
            <Link to="/browse">{t('browse')}</Link>
            <Link to="/register">{t('signup')}</Link>
            <Link to="/rental-shops">{t('forRentalShops')}</Link>
            <Link to="/privacy">{t('landing.privacy')}</Link>
            <Link to="/terms">{t('landing.terms')}</Link>
            <button type="button" className="lp-foot-btn" onClick={openCookiePreferences}>
              {t('cookies.preferences.title')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

const PROTECT_ICONS = {
  deposit: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  photo: <><path d="M3 8.5h3.2l1.6-2.3h8.4l1.6 2.3H21v10H3v-10z" /><circle cx="12" cy="13" r="3.4" /></>,
  choice: <><circle cx="12" cy="12" r="9" /><path d="M8 12.4l2.7 2.6L16 9.6" /></>,
}

function ProtectRule({ icon, title, body }: { icon: keyof typeof PROTECT_ICONS; title: string; body: string }) {
  return (
    <div className="lp-rule">
      <span className="lp-rule-i" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{PROTECT_ICONS[icon]}</svg>
      </span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  )
}
