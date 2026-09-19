import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Проверяем не «есть ли французский текст», а то, ради чего первый экран
 * переписан 12.08: он обращён к ВЛАДЕЛЬЦУ инструмента и говорит правду о
 * витрине.
 *
 * Прежний тест держался за строку «Les outils de votre voisin, à portée
 * de main» — заголовок арендатора. Он упал вместе со сменой адресата, и
 * это правильное падение: тест зафиксировал старое решение, а решение
 * поменяли. Подгонять строку молча было бы хуже — тогда тест перестал бы
 * что-либо охранять.
 *
 * 19.09 изменилась ещё одна посылка, и тоже осознанно. Проверка «пустота
 * названа прямо» искала ДОСЛОВНО «0 outil en ligne» — потому что число
 * лежало в словаре строкой. Инвариант был и остаётся тот же: лендинг
 * говорит о витрине правду. Но правда о числе, записанная руками, верна
 * ровно до первой выложенной вещи, и врёт она в первую очередь тому, кто
 * эту вещь и выложил. Поэтому число теперь считается, а тест проверяет
 * СООТВЕТСТВИЕ числа каталогу — в обе стороны.
 */

let count: number | undefined = 0

vi.mock('../../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({
    data: count,
    catalogIsEmpty: count === undefined ? undefined : count === 0,
  }),
}))

import HeroSection from '../HeroSection'

describe('первый экран лендинга', () => {
  const renderHero = () => render(<MemoryRouter><HeroSection /></MemoryRouter>)

  beforeEach(() => { count = 0 })

  it('главное действие ведёт на выкладку, а не на витрину', () => {
    renderHero()
    const primary = screen.getByRole('link', { name: /déposer un outil/i })
    expect(primary).toHaveAttribute('href', '/list-item')
  })

  it('витрина предложена вторым действием, а не первым', () => {
    renderHero()
    expect(screen.getByRole('link', { name: /voir la vitrine/i })).toHaveAttribute('href', '/browse')
  })

  it('пустота витрины названа прямо, а не скрыта', () => {
    renderHero()
    expect(screen.getByText(/0 outil en ligne/i)).toBeInTheDocument()
    expect(screen.getByText(/le premier que verront les voisins/i)).toBeInTheDocument()
  })

  // ГЛАВНОЕ. «Ваш будет первым» — обещание, и оно перестаёт быть правдой
  // с первой же выложенной вещью.
  it('на непустом каталоге показывает настоящее число, а не ноль', () => {
    count = 7
    renderHero()
    expect(screen.getByText(/7 outils en ligne/i)).toBeInTheDocument()
    expect(screen.queryByText(/0 outil en ligne/i)).not.toBeInTheDocument()
  })

  it('и обещание «ваш будет первым» при этом снимается', () => {
    count = 7
    renderHero()
    expect(screen.queryByText(/le premier que verront les voisins/i)).not.toBeInTheDocument()
    expect(screen.getByText(/vos voisins ont déjà commencé/i)).toBeInTheDocument()
  })

  // Множественное число считает библиотека: во французском «one» покрывает
  // и 0, и 1, и вручную это правило повторять нельзя.
  it('одна вещь — единственное число', () => {
    count = 1
    renderHero()
    expect(screen.getByText(/1 outil en ligne/i)).toBeInTheDocument()
  })

  // Утверждение о числе, показанное до того, как число известно, — заявка
  // наугад. Отсутствие утверждения честнее неверного.
  it('пока ответа нет, о числе не говорится ничего', () => {
    count = undefined
    renderHero()
    expect(screen.queryByText(/en ligne aujourd/i)).not.toBeInTheDocument()
    // Остальной экран при этом на месте: скрыт один блок, а не страница.
    expect(screen.getByRole('link', { name: /déposer un outil/i })).toBeInTheDocument()
  })

  it('снимок подписан как иллюстративный и имеет альтернативный текст', () => {
    renderHero()
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt')
    expect(img.getAttribute('alt')!.length).toBeGreaterThan(10)
    expect(screen.getByText(/photo d’illustration/i)).toBeInTheDocument()
  })
})
