import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HeroSection from '../HeroSection'

/**
 * Проверяем не «есть ли французский текст», а то, ради чего первый экран
 * переписан 12.08: он обращён к ВЛАДЕЛЬЦУ инструмента и говорит правду о
 * пустой витрине.
 *
 * Прежний тест держался за строку «Les outils de votre voisin, à portée
 * de main» — заголовок арендатора. Он упал вместе со сменой адресата, и
 * это правильное падение: тест зафиксировал старое решение, а решение
 * поменяли. Подгонять строку молча было бы хуже — тогда тест перестал бы
 * что-либо охранять.
 */
describe('первый экран лендинга', () => {
  const renderHero = () => render(<MemoryRouter><HeroSection /></MemoryRouter>)

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

  it('снимок подписан как иллюстративный и имеет альтернативный текст', () => {
    renderHero()
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt')
    expect(img.getAttribute('alt')!.length).toBeGreaterThan(10)
    expect(screen.getByText(/photo d’illustration/i)).toBeInTheDocument()
  })
})
