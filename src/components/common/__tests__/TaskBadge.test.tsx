import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TaskBadge from '../TaskBadge'

// Словари подключены настройкой набора (src/test/setup.ts), поэтому
// подписи здесь настоящие, а не заглушки: иначе проверка «вслух читается
// осмысленно» проверяла бы мой же макет.

describe('значок дел', () => {
  /**
   * ГЛАВНОЕ ПРАВИЛО. При нуле — НИЧЕГО, а не кружок с нулём.
   *
   * Пустой значок занимает то же место и приучает глаз его не замечать:
   * к тому времени, когда там появится единица, человек уже перестал
   * туда смотреть.
   */
  it('при нуле не рисуется вовсе', () => {
    const { container } = render(<TaskBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('отрицательное число — тоже ничего, а не «-1»', () => {
    // Такого не должно случаться, но кружок с минусом хуже пустоты.
    const { container } = render(<TaskBadge count={-3} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('показывает число', () => {
    render(<TaskBadge count={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  /**
   * Трёхзначное число в кружке нечитаемо, а разницы между 12 и 40 делами
   * для решения «открыть сейчас или вечером» уже нет.
   */
  it('больше девяти сворачивается в «9+»', () => {
    render(<TaskBadge count={42} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('ровно девять показывается числом', () => {
    render(<TaskBadge count={9} />)
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  /**
   * Вслух цифра рядом со словом читается как часть подписи: «Mes outils
   * 3». Без пояснения непонятно, три чего.
   */
  it('вслух читается осмысленно, а не одной цифрой', () => {
    render(<TaskBadge count={1} />)
    const badge = screen.getByRole('status')
    expect(badge.getAttribute('aria-label')).toMatch(/chose à faire/i)
    expect(badge.getAttribute('aria-label')).toContain('1')
  })

  it('множественное число берётся из словаря, а не из ветки в разметке', () => {
    render(<TaskBadge count={4} />)
    // «choses», а не «chose»: правила у fr и nl разные, и ветка
    // `count > 1 ? 's' : ''` даёт правильный ответ ровно для одного языка.
    expect(screen.getByRole('status').getAttribute('aria-label')).toMatch(/choses/i)
  })

  it('на панели и в навбаре — разные места, один компонент', () => {
    const { container: nav } = render(<TaskBadge count={2} placement="nav" />)
    const { container: tab } = render(<TaskBadge count={2} placement="tab" />)
    expect(nav.querySelector('.task-badge-nav')).toBeTruthy()
    expect(tab.querySelector('.task-badge-tab')).toBeTruthy()
  })
})
