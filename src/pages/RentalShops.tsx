import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Страница для прокатных контор.
 *
 * До 11.08 подвал вёл на /business с тарифами Starter €49 / Growth €99.
 * Коммит 1409b3a снял платную модель и понизил ссылку до <span>: надпись
 * «Pour les magasins de location» осталась, а вести стало некуда.
 *
 * Здесь нет тарифов, потому что их нет в продукте. Нет и «нас уже выбрали
 * N контор»: контор ноль, и выдумывать число ради веса — ровно тот приём,
 * из-за которого потом не верят ничему.
 *
 * Раздел «Чего RentIt не делает» стоит НЕ из скромности. Прокатчик,
 * который прочтёт про страховку и депонирование там, где их нет, придёт
 * с ожиданием и уйдёт с обманом. Названные границы дешевле разбирательства.
 */
export default function RentalShops() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--muted)', marginBottom: 'var(--space-3)',
        }}>
          {t('shops.eyebrow')}
        </p>

        <h1 style={{
          fontSize: 'clamp(var(--text-xl), 6vw, var(--text-2xl))',
          fontWeight: '800', letterSpacing: '-0.03em',
          marginBottom: 'var(--space-4)', lineHeight: 1.1,
        }}>
          {t('shops.title')}
        </h1>

        <p style={{
          fontSize: 'var(--text-base)', color: 'var(--muted)',
          lineHeight: 1.6, marginBottom: 'var(--space-7)',
        }}>
          {t('shops.lede')}
        </p>

        {/* Что есть сегодня */}
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '800', marginBottom: 'var(--space-4)' }}>
          {t('shops.haveTitle')}
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--space-7)' }}>
          {['have1', 'have2', 'have3', 'have4'].map(k => (
            <li key={k} style={{
              display: 'flex', gap: 'var(--space-3)',
              padding: 'var(--space-3) 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 'var(--text-base)', lineHeight: 1.5,
            }}>
              <span aria-hidden="true" style={{ color: 'var(--text)', flexShrink: 0 }}>—</span>
              <span>{t(`shops.${k}`)}</span>
            </li>
          ))}
        </ul>

        {/* Границы. Названные вслух — часть предложения, а не оговорка мелким шрифтом */}
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '800', marginBottom: 'var(--space-2)' }}>
          {t('shops.notTitle')}
        </h2>
        <p style={{
          fontSize: 'var(--text-sm)', color: 'var(--muted)',
          marginBottom: 'var(--space-4)', lineHeight: 1.5,
        }}>
          {t('shops.notLede')}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--space-7)' }}>
          {['not1', 'not2', 'not3', 'not4'].map(k => (
            <li key={k} style={{
              display: 'flex', gap: 'var(--space-3)',
              padding: 'var(--space-3) 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 'var(--text-base)', lineHeight: 1.5,
            }}>
              <span aria-hidden="true" style={{ color: 'var(--muted)', flexShrink: 0 }}>×</span>
              <span>{t(`shops.${k}`)}</span>
            </li>
          ))}
        </ul>

        {/* Где мы на самом деле */}
        <div className="card" style={{ marginBottom: 'var(--space-7)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '800', marginBottom: 'var(--space-3)' }}>
            {t('shops.stateTitle')}
          </h2>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--muted)' }}>
            {t('shops.stateBody')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary" style={{ minHeight: '44px' }}>
            {t('shops.ctaPrimary')}
          </Link>
          <Link to="/browse" className="btn btn-secondary" style={{ minHeight: '44px' }}>
            {t('shops.ctaSecondary')}
          </Link>
        </div>

      </div>
    </div>
  )
}
