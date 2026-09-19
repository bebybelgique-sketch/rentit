import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCatalogHasItems } from '../../hooks/useCatalogHasItems'

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
 *
 * ЧИСЛО СЧИТАЕТСЯ, А НЕ НАПИСАНО. До 19.09.2026 строка «0 outil en ligne
 * aujourd'hui» лежала в словаре как есть. Пока витрина пуста, она верна —
 * и перестаёт быть верной в ту самую минуту, когда кто-то выложит первый
 * инструмент. Причём соврала бы она в первую очередь ТОМУ, кто только что
 * выложил: он возвращается на главную и читает, что вещей ноль, а его
 * была бы первой.
 *
 * Хуже всего, что подводило бы это именно честность — единственное, ради
 * чего блок и написан. Правда, которую надо не забыть переписать руками,
 * не правда, а отложенная ложь: ручной шаг, который однажды не сделают,
 * это дефект замысла, а не забывчивость.
 */
export default function HeroSection() {
  const { t } = useTranslation()

  // Тот же счёт, что у витрины: доступные вещи БЕЗ фильтров, head-запрос,
  // одна запись в кэше на минуту. `catalogIsEmpty === undefined` означает
  // «ответа нет» — намеренно не «пусто».
  const { data: liveCount, catalogIsEmpty } = useCatalogHasItems()

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
              нужно так, чтобы она работала на человека, а не на нас.
              Число берётся из каталога; довод под ним меняется вместе с ним:
              на нуле «ваш будет первым», дальше — «соседи уже начали».

              Пока ответа нет, блок НЕ РИСУЕТСЯ вовсе. Это стоит небольшого
              сдвига вёрстки, и стоит того: утверждение о числе, показанное
              до того, как число известно, — заявка наугад. Отсутствие
              утверждения честнее неверного, а сбой сети тут обычное дело. */}
          {catalogIsEmpty !== undefined && (
            <p className="lp-zero">
              <b>{t('landing.liveCount', { count: liveCount ?? 0 })}</b>{' '}
              {catalogIsEmpty ? t('landing.zeroBody') : t('landing.liveBody')}
            </p>
          )}
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
