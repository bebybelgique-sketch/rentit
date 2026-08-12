import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import HeroSection from '../components/landing/HeroSection'
import CategoriesSection from '../components/landing/CategoriesSection'

/**
 * Лендинг.
 *
 * Что изменилось 12.08 и почему — коротко, чтобы не разбирать заново:
 *
 * 1. АДРЕСАТ. Страница обращается к владельцу инструмента, а не к
 *    арендатору. При нуле объявлений искать нечего, и поиск первым
 *    экраном тратил каждого посетителя впустую.
 *
 * 2. ПАЛИТРА. Лайм #ADFF2F на чёрном и пара Syne + DM Mono сняты
 *    целиком. Новый набор — красный, жёлтый, чёрный, серебро: язык
 *    самого инструмента. Роли разведены жёстко, см. src/index.css.
 *
 * 3. ОДИН СЛОВАРЬ. Раньше текст стоял константами по-французски, при
 *    том что переключатель в шапке крутил fr→en→nl: человек нажимал EN
 *    и получал английскую шапку над французской страницей. Теперь все
 *    строки в landing.* во всех трёх языках.
 *
 * 4. СВОЙ <style> УБРАН. Страница инжектила 255 строк CSS со своим
 *    сбросом, своим импортом шрифтов и своей палитрой — отсюда и
 *    брались «два разных продукта» на стыке лендинга и приложения.
 *
 * Снято намеренно и НЕ возвращать без довода:
 * — бегущая строка с десятью типами инструментов по-английски: она
 *   читалась как ассортимент, которого нет;
 * — панель «Revenus par location»: на 390px резала текст до «Gratui» и
 *   «Annonc», а сравнивать в ней было нечего;
 * — мёртвая светлая тема (`const [isDark] = useState(true)` никогда не
 *   менялся, кнопки темы в разметке не было).
 */
export default function Landing() {
  const { t } = useTranslation()

  const steps = [
    { n: '01', title: t('landing.step1Title'), body: t('landing.step1Body') },
    { n: '02', title: t('landing.step2Title'), body: t('landing.step2Body') },
    { n: '03', title: t('landing.step3Title'), body: t('landing.step3Body') },
  ]

  const limits = [
    { title: t('landing.limit1Title'), body: t('landing.limit1Body') },
    { title: t('landing.limit2Title'), body: t('landing.limit2Body') },
    { title: t('landing.limit3Title'), body: t('landing.limit3Body') },
  ]

  return (
    <div>
      <HeroSection />

      {/* Три шага со стороны владельца. Нумерация здесь не украшение:
          это настоящая последовательность, и порядок несёт смысл. */}
      <section className="lp-band lp-band-line">
        <div className="lp-wrap">
          <p className="lp-label">{t('landing.stepsLabel')}</p>
          <h2 className="lp-h2" style={{ maxWidth: '18ch' }}>{t('landing.stepsTitle')}</h2>
          <div className="lp-cols3">
            {steps.map(s => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-n">{s.n}</div>
                <h3 className="lp-h3">{s.title}</h3>
                <p className="lp-txt">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Границы — предупредительная табличка: жёлтое по чёрному, как
          маркировка на корпусе инструмента. Названная заранее граница
          дешевле разбирательства, поэтому она крупная и в середине
          страницы, а не мелким шрифтом внизу. */}
      <section className="lp-band lp-band-dark">
        <div className="lp-wrap">
          <div className="lp-warn-head">
            <div className="lp-warn-mark" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5 22 20H2z" /><path d="M12 10v4.2" /><path d="M12 17.4h.01" />
              </svg>
            </div>
            <div>
              <p className="lp-label">{t('landing.limitsLabel')}</p>
              <h2 className="lp-h2" style={{ maxWidth: '20ch' }}>{t('landing.limitsTitle')}</h2>
            </div>
          </div>

          <p className="lp-txt" style={{ marginTop: 'var(--space-5)' }}>{t('landing.limitsLede')}</p>

          <div className="lp-cols3">
            {limits.map(l => (
              <div key={l.title} className="lp-limit">
                <svg className="lp-limit-x" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" />
                </svg>
                <h3 className="lp-h3">{l.title}</h3>
                <p className="lp-txt">{l.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CategoriesSection />

      {/* Короткий блок для арендатора. Он второй по счёту намеренно, и
          пустота витрины названа вслух: тупик — это когда человека
          отправляют в пустоту молча. */}
      <section className="lp-band lp-band-line">
        <div className="lp-wrap lp-renter">
          <div>
            <p className="lp-label" style={{ margin: 0 }}>{t('landing.renterLabel')}</p>
          </div>
          <div>
            <h2 className="lp-h2" style={{ fontSize: 'clamp(21px, 2.9vw, 30px)', maxWidth: '26ch', marginBottom: 'var(--space-4)' }}>
              {t('landing.renterTitle')}
            </h2>
            <p className="lp-txt" style={{ marginBottom: 'var(--space-5)' }}>{t('landing.renterBody')}</p>
            <div className="lp-btns">
              <Link to="/browse" className="lp-btn lp-btn-alt">{t('landing.ctaSecondary')}</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-band lp-band-dark lp-final">
        <div className="lp-wrap">
          <h2 className="lp-h2">{t('landing.finalTitle')}</h2>
          <p className="lp-txt" style={{ maxWidth: '46ch' }}>{t('landing.finalBody')}</p>
          <div className="lp-btns">
            <Link to="/list-item" className="lp-btn lp-btn-do">{t('landing.finalCta')}</Link>
          </div>
        </div>
      </section>

      <div className="lp-wrap">
        <footer className="lp-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '21px', letterSpacing: '-0.03em' }}>
              Rent<span style={{ color: 'var(--action)' }}>It</span>
            </span>
            <span style={{ fontFamily: 'var(--font-text)', fontSize: '14px', color: 'var(--text-faint)' }}>
              Belgium · {new Date().getFullYear()}
            </span>
          </div>
          <div className="lp-foot-l">
            <Link to="/browse">{t('browse')}</Link>
            <Link to="/register">{t('signup')}</Link>
            <Link to="/rental-shops">{t('forRentalShops')}</Link>
            <Link to="/privacy">{t('landing.privacy')}</Link>
            <Link to="/terms">{t('landing.terms')}</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
