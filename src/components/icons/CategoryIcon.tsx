import type { FC } from 'react'

/**
 * Иконки категорий, 24×24, одна обводка, currentColor.
 *
 * Зачем отдельным файлом, а не полем в catalog.ts: справочник хранит
 * СТРУКТУРУ (какие значения существуют), а это — оформление. Плюс
 * практическое: эмодзи из catalog.ts сегодня стоят ещё на витрине, на
 * странице вещи и в форме выкладки. Заменить их там — отдельная работа
 * по четырём экранам, и тащить её в правку лендинга значит смешать две
 * задачи в одном диффе.
 *
 * Соответствие ключей — значениям категорий из catalog.ts. Неизвестная
 * категория рисует коробку, а не пустоту: пустое место на карточке
 * читается как поломка вёрстки.
 */
const PATHS: Record<string, JSX.Element> = {
  power_tools: (
    <>
      <path d="M3 7h10v6H3z" />
      <path d="M13 9h4l4-1.2v3.4L17 10h-4" />
      <path d="M6 13v5h3v-5" />
    </>
  ),
  hand_tools: (
    <path d="M18.4 3.6a4.6 4.6 0 0 0-6.1 6.1L4 18l2 2 8.3-8.3a4.6 4.6 0 0 0 6.1-6.1l-2.7 2.7-2.1-2.1z" />
  ),
  garden: (
    <>
      <path d="M4 20c0-8 5-13 16-14 0 10-5 15-13 15H4z" />
      <path d="M4 20c3-5 7-8 12-10" />
    </>
  ),
  construction: (
    <>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M10 7.6V4h4v3.6" />
      <rect x="2" y="15" width="20" height="3.4" rx="1.2" />
    </>
  ),
  cleaning: (
    <>
      <path d="M8 9h7v12H8z" />
      <path d="M10 9V5h4" />
      <path d="M15 6h4" />
      <path d="M18 3.5v5" />
    </>
  ),
  measuring: (
    <>
      <rect x="2" y="8" width="20" height="8" rx="1.4" />
      <path d="M7 8v3M12 8v4M17 8v3" />
    </>
  ),
}

const FALLBACK = (
  <>
    <path d="M3 8l9-4 9 4-9 4-9-4z" />
    <path d="M3 8v8l9 4 9-4V8" />
  </>
)

type Props = { category: string; size?: number; className?: string }

const CategoryIcon: FC<Props> = ({ category, size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[category] ?? FALLBACK}
  </svg>
)

export default CategoryIcon
