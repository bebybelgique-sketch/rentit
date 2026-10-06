import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBrowseItems } from '../../hooks/useBrowseItems'
import { coverPhoto } from '../../lib/items'
import { money } from '../../domain/push'
import CategoryIcon from '../icons/CategoryIcon'

const SHOWN = 5

/**
 * Лента «Les dernières annonces» под первым экраном.
 *
 * Только настоящие объявления — тот же browse_items, что у витрины, без
 * фильтров: точки посетителя здесь нет, поэтому порядок — от новых к старым,
 * и заголовок обещает ровно это, а не «près de chez vous».
 *
 * Пока ответа нет, при сбое и при пустом каталоге ленты нет вовсе. Пустую
 * ленту не рисуем: о пустоте честно говорит строка счётчика на первом
 * экране, а коробка без карточек сказала бы то же самое хуже.
 */
export default function LatestListings() {
  const { t } = useTranslation()
  const { data: items } = useBrowseItems({ limit: SHOWN })

  if (!items?.length) return null

  return (
    <section className="lp-latest" aria-labelledby="lp-latest-title">
      <div className="lp-wrap">
        <div className="lp-latest-head">
          <div>
            <h2 id="lp-latest-title" className="lp-h2">{t('landing.latestTitle')}</h2>
            <p className="lp-sub">{t('landing.latestSub')}</p>
          </div>
          <Link to="/browse" className="lp-more">{t('landing.latestMore')}</Link>
        </div>

        <ul className="lp-cards">
          {items.slice(0, SHOWN).map(item => {
            const cover = coverPhoto(item)
            return (
              <li key={item.id}>
                <Link to={`/item/${item.id}`} className="lp-card">
                  <div className="lp-card-ph">
                    {cover
                      ? <img src={cover} alt="" loading="lazy" decoding="async" />
                      : <CategoryIcon category={item.category} size={48} />}
                  </div>
                  <h3>{item.title}</h3>
                  {item.address && <div className="lp-card-where">{item.address}</div>}
                  <div className="lp-card-p"><b>{money(item.price_per_day)}</b> {t('home.perDay')}</div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
