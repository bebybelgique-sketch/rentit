import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCatalogHasItems } from '../../hooks/useCatalogHasItems'
import { CATEGORIES } from '../../domain/catalog'
import { money } from '../../domain/push'
import { weekendLabel } from '../../domain/weekend'
import CategoryIcon from '../icons/CategoryIcon'
import { browseHref, type WhenChoice } from './browseHref'

/**
 * Первый экран лендинга — ПОИСК: «что, где, когда».
 *
 * С 12.08 до 05.10 экран был обращён к владельцу («Vos outils dorment»,
 * главная кнопка — выкладка). Довод был замеренный: вещей ноль, искать
 * нечего, и каждый посетитель, уведённый в поиск, попадал в тупик.
 *
 * Почему развернули — две вещи изменились:
 * 1. Тупика больше нет. Пустой поиск на витрине кончается формой «Dites-le»
 *    (ToolDemandForm): человек оставляет, что искал и где. Это спрос, и его
 *    видят владельцы. Поиск без результата теперь приносит сигнал, а не
 *    теряет посетителя.
 * 2. Первый экран выбрал Рамзан (04.10, ответ на вопрос с превью): поиск
 *    «что + где». Макет — холст Claude Design «Atelier v2».
 *
 * Путь владельца с первого экрана не убран, а стал тише: ссылка в строке
 * счётчика, при пустом каталоге — «Déposez le premier».
 *
 * ЧЕСТНОСТЬ, которую держат тесты:
 * — число объявлений считается (useCatalogHasItems), а не пишется словами;
 *   пока ответа нет, о числе не говорится ничего;
 * — карточка в коллаже подписана «Exemple d’annonce»: это иллюстрация, а не
 *   вещь с витрины;
 * — даты в коллаже — ближайшие выходные, посчитанные сегодня. Строка
 *   «sam. 11 → dim. 12 oct.» в словаре была бы верна одну неделю.
 */
export default function HeroSection() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data: liveCount, catalogIsEmpty } = useCatalogHasItems()

  const [what, setWhat] = useState('')
  const [where, setWhere] = useState('')
  const [when, setWhen] = useState<WhenChoice>('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigate(browseHref(what, where, when, new Date()))
  }

  return (
    <header className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-main">
          <p className="lp-where">
            <span className="lp-where-pin" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
            </span>
            {t('landing.eyebrow')}
          </p>

          <h1 className="lp-h1">
            {t('landing.h1a')} <em>{t('landing.h1b')}</em>
          </h1>

          <p className="lp-lede">{t('landing.lede')}</p>

          <form role="search" aria-label={t('landing.searchLabel')} className="lp-search" onSubmit={onSubmit}>
            <div className="lp-field">
              <label htmlFor="lp-what">{t('landing.searchWhat')}</label>
              <input id="lp-what" type="search" enterKeyHint="search" autoComplete="off"
                placeholder={t('landing.searchWhatPh')}
                value={what} onChange={e => setWhat(e.target.value)} />
            </div>
            <div className="lp-field">
              <label htmlFor="lp-where">{t('landing.searchWhere')}</label>
              <input id="lp-where" type="text" autoComplete="address-level2"
                placeholder={t('landing.searchWherePh')}
                value={where} onChange={e => setWhere(e.target.value)} />
            </div>
            <div className="lp-field">
              <label htmlFor="lp-when">{t('landing.searchWhen')}</label>
              <select id="lp-when" value={when} onChange={e => setWhen(e.target.value as WhenChoice)}>
                <option value="">{t('landing.whenAny')}</option>
                <option value="this">{t('landing.whenThis')}</option>
                <option value="next">{t('landing.whenNext')}</option>
              </select>
            </div>
            {/* Имя кнопке — атрибутом: на широком экране подпись скрыта
                (display: none), и без него кнопка была бы безымянной для
                чтения с экрана. Поймал E2E, а не юнит: jsdom не грузит CSS. */}
            <button type="submit" className="lp-go" aria-label={t('landing.searchGo')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="lp-go-label">{t('landing.searchGo')}</span>
            </button>
          </form>

          {/* Число — из каталога, и пока его нет, строка о нём молчит:
              утверждение, показанное до ответа, — заявка наугад. Ссылка для
              владельца стоит при любом ответе. */}
          <p className="lp-live">
            {catalogIsEmpty !== undefined && (
              <>
                <span className={catalogIsEmpty ? 'lp-live-dot is-zero' : 'lp-live-dot'} aria-hidden="true" />
                <span>{t('landing.liveCount', { count: liveCount ?? 0 })}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <Link to="/list-item">{catalogIsEmpty ? t('landing.ownerFirst') : t('landing.ownerLink')}</Link>
          </p>

          <nav aria-label={t('landing.tasksLabel')} className="lp-tasks">
            {CATEGORIES.map(c => (
              <Link key={c.value} to={`/browse?category=${c.value}`} className="lp-task">
                <CategoryIcon category={c.value} size={20} />
                {t(c.taskKey)}
              </Link>
            ))}
          </nav>
        </div>

        <HeroArt lang={i18n.language} />
      </div>
    </header>
  )
}

/**
 * Коллаж справа — оформление, а не содержание: скрыт от чтения с экрана
 * целиком. Всё, что похоже на данные, подписано как пример или посчитано.
 * Снимки — CC0, источники в public/landing-photos.txt.
 */
function HeroArt({ lang }: { lang: string }) {
  const { t } = useTranslation()
  return (
    <div className="lp-art" aria-hidden="true">
      <div className="lp-art-slab" />
      <div className="lp-art-photo">
        <img src="/hero-drill.jpg" alt="" width={960} height={640} />
      </div>
      <div className="lp-float lp-float-cash"><i />{t('landing.artCash')}</div>
      <div className="lp-float lp-float-listing">
        <img src="/example-washer.jpg" alt="" width={200} height={200} />
        <div>
          <span className="lp-ex">{t('landing.artExample')}</span>
          <b>{t('landing.artExampleTitle')}</b>
          <span className="lp-float-meta">{t('landing.artExamplePlace')}</span>
          <span className="lp-float-price">{money(25)} <small>{t('home.perDay')}</small></span>
        </div>
      </div>
      <div className="lp-float lp-float-dates">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <div>
          <b>{weekendLabel(new Date(), lang)}</b>
          <span>{t('landing.artDatesBody')}</span>
        </div>
      </div>
    </div>
  )
}
