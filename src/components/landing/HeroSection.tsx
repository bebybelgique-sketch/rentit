import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Первый экран лендинга.
 *
 * Обращён к ВЛАДЕЛЬЦУ инструмента, а не к арендатору. Довод замеренный:
 * объявлений в базе ноль, броней ноль. В двустороннем рынке с нулём
 * предложения узкое место одно, и это не способность посетителя искать —
 * искать нечего. Каждый посетитель, которого страница уводила в
 * арендаторы, был потрачен впустую.
 *
 * Что стояло здесь до 12.08: поисковая строка «QUOI / OÙ» первым делом,
 * значок «0 outil disponible en Brabant Wallon», строка статистики
 * «0 / OUTILS DISPO» и главная кнопка «Voir les outils →» на пустую
 * витрину. Страница трижды объявляла собственную пустоту и вела в тупик.
 *
 * Ноль остался, но сменил роль: не отчёт о провале, а довод «ваш будет
 * первым». Это единственная валюта, которая у продукта сейчас есть, —
 * позиция первого.
 */
export default function HeroSection() {
  const { t } = useTranslation()

  return (
    <header className="lp-wrap lp-hero">
      <div className="lp-hero-grid">
        <div>
          <p className="lp-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
            {t('landing.eyebrow')}
          </p>

          <h1 className="lp-h1">
            {t('landing.h1a')}<br />{t('landing.h1b')}
          </h1>

          <p className="lp-lede" style={{ marginBottom: 'var(--space-6)' }}>
            {t('landing.lede')}
          </p>

          <div className="lp-btns">
            <Link to="/list-item" className="lp-btn lp-btn-do">{t('landing.ctaPrimary')}</Link>
            <Link to="/browse" className="lp-btn lp-btn-alt">{t('landing.ctaSecondary')}</Link>
          </div>

          {/* Пустота названа прямо. Скрывать её нечестно, а объяснять
              нужно так, чтобы она работала на человека, а не на нас. */}
          <p className="lp-zero">
            <b>{t('landing.zeroCount')}</b> {t('landing.zeroBody')}
          </p>
        </div>

        {/* Снимок иллюстративный, и подпись говорит это вслух: кадр чужой
            и красивый, без оговорки он читался бы как инструмент, уже
            лежащий на витрине. Витрина пуста. Лицензия — public/hero-tools.txt */}
        <figure className="lp-shot">
          <img src="/hero-tools.jpg" alt={t('landing.photoAlt')} width={1000} height={840} />
          <figcaption>{t('landing.photoCaption')}</figcaption>
        </figure>
      </div>
    </header>
  )
}
