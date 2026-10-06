import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Лендинг говорит о витрине правду — и перестаёт, как только она перестала
 * быть правдой.
 *
 * До 06.10 этот файл проверял блок арендатора («La vitrine est vide
 * aujourd’hui») и финальный заголовок («Le premier outil … n’est pas encore
 * en ligne»). Оба блока сняты вместе с макетом Atelier v2, и проверки их
 * строк ушли с ними. Инвариант остался и проверяется на всей странице:
 * о пустоте говорит только посчитанная строка первого экрана, и ни одна
 * строка страницы не утверждает пустоту при непустом каталоге.
 *
 * Добавлено: калькулятор владельца считает введённое, а не показывает
 * готовое число, и его пример помечен как пример.
 */

let count: number | undefined = 0

vi.mock('../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({
    data: count,
    catalogIsEmpty: count === undefined ? undefined : count === 0,
  }),
}))

// Лента объявлений спрашивает витрину отдельно; её правду проверяет
// LatestListings.test.tsx, здесь она пуста.
vi.mock('../../hooks/useBrowseItems', () => ({
  useBrowseItems: () => ({ data: [] }),
}))

import Landing from '../Landing'

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>)

describe('лендинг говорит о витрине правду', () => {
  beforeEach(() => { count = 0 })

  it('пустой каталог — пустота названа один раз, числом', () => {
    renderLanding()
    expect(screen.getAllByText(/0 outil en ligne/i)).toHaveLength(1)
  })

  it('непустой каталог — нигде ни нуля, ни «первого»', () => {
    count = 3
    renderLanding()
    expect(document.body.textContent).not.toMatch(/0 outil|vitrine est vide|pas encore en ligne|le premier/i)
    expect(screen.getByText(/3 outils en ligne/i)).toBeInTheDocument()
  })

  it('ответа ещё нет — о пустоте не утверждается ничего', () => {
    count = undefined
    renderLanding()
    expect(document.body.textContent).not.toMatch(/en ligne aujourd|vitrine est vide|pas encore en ligne/i)
  })
})

describe('блок владельца', () => {
  it('калькулятор считает введённое', () => {
    renderLanding()
    const result = screen.getByText(/par mois, pour vous/i).parentElement!
    expect(result).toHaveTextContent('€24')
    fireEvent.change(screen.getByLabelText(/prix par jour/i), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText(/jours loués par mois/i), { target: { value: '3' } })
    expect(result).toHaveTextContent('€45')
  })

  it('мусор в поле — ноль, а не NaN', () => {
    renderLanding()
    fireEvent.change(screen.getByLabelText(/prix par jour/i), { target: { value: '' } })
    expect(screen.getByText(/par mois, pour vous/i).parentElement).toHaveTextContent('€0')
  })

  it('карточка заявки — подписанная иллюстрация, скрытая от чтения', () => {
    const { container } = renderLanding()
    const art = container.querySelector('.lp-owner-art')!
    expect(art).toHaveAttribute('aria-hidden', 'true')
    expect(art).toHaveTextContent(/aperçu de votre écran/i)
  })

  it('выкладка — с блока владельца', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: /déposer un outil/i })).toHaveAttribute('href', '/list-item')
  })
})

describe('что защищает и чего RentIt не делает', () => {
  it('ограничения названы на самой странице, после защиты', () => {
    renderLanding()
    const protect = screen.getByRole('heading', { name: /ce qui vous protège/i })
    const limits = screen.getByText(/ne fournit aucune assurance/i)
    expect(protect.compareDocumentPosition(limits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(limits).toHaveTextContent(/ne touche pas à l’argent/i)
  })
})
