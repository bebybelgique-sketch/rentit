import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CATEGORIES } from '../../domain/catalog'
import CategoryIcon from '../icons/CategoryIcon'

/**
 * Шесть категорий.
 *
 * Состав — ТОЛЬКО из src/domain/catalog.ts, текст — из словаря. Своя
 * копия названий жила здесь и разошлась с остальным продуктом:
 * «Jardin & Extérieur» против «Jardinage», «Mesure» против
 * «Mesure & Détection».
 *
 * Раздел отвечает на вопрос владельца «подходит ли сюда мой инструмент»,
 * а не арендатора «что бы взять». Отсюда и заголовок.
 *
 * Эмодзи из каталога здесь не используются: иконка интерфейса должна быть
 * SVG, а не эмодзи — эмодзи рисуется шрифтом системы и на каждой машине
 * выглядит по-своему. В самом каталоге они пока остаются, их замена
 * задевает витрину, страницу вещи и форму выкладки — отдельная работа.
 */
export default function CategoriesSection() {
  const { t } = useTranslation()

  return (
    <section className="lp-band lp-band-silver">
      <div className="lp-wrap">
        <p className="lp-label">{t('landing.catsLabel')}</p>
        <h2 className="lp-h2" style={{ maxWidth: '22ch' }}>{t('landing.catsTitle')}</h2>

        <div className="lp-cats">
          {CATEGORIES.map(c => (
            <Link key={c.value} to={`/browse?category=${c.value}`} className="lp-cat">
              <CategoryIcon category={c.value} />
              <span>
                {/* Ведущий эмодзи из подписи снимается: он остаётся в
                    словаре ради остальных экранов, которые ещё на нём. */}
                <span className="lp-cat-n">{t(c.labelKey).replace(/^\S+\s/, '')}</span>
                <span className="lp-cat-h">{t(c.hintKey)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
