import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Лендинг называет пустоту витрины вслух — и обязан перестать, как только
 * она перестала быть правдой. До 01.10 блок арендатора («La vitrine est vide
 * aujourd’hui») и финальный заголовок («Le premier outil … n’est pas encore
 * en ligne») стояли без условия: в минуту первой вещи главная говорила бы
 * одновременно «1 outil en ligne» (герой считает) и «revenez plus tard».
 * Соврала бы она первым делом тому, кто эту вещь выложил.
 *
 * Тот же счёт, что у HeroSection; его тест проверяет число, этот — тексты
 * вокруг него.
 */

let count: number | undefined = 0

vi.mock('../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({
    data: count,
    catalogIsEmpty: count === undefined ? undefined : count === 0,
  }),
}))

import Landing from '../Landing'

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>)

describe('лендинг говорит о витрине правду', () => {
  beforeEach(() => { count = 0 })

  it('пустой каталог — пустота названа прямо', () => {
    renderLanding()
    expect(screen.getByText(/la vitrine est vide aujourd’hui/i)).toBeInTheDocument()
    expect(screen.getByText(/n’est pas encore en ligne/i)).toBeInTheDocument()
  })

  it('непустой каталог — ни «витрина пуста», ни «первого ещё нет»', () => {
    count = 3
    renderLanding()
    expect(screen.queryByText(/la vitrine est vide/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/revenez quand un voisin aura déposé/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/n’est pas encore en ligne/i)).not.toBeInTheDocument()
    expect(screen.getByText(/un voisin l’a peut-être/i)).toBeInTheDocument()
  })

  // Пока ответа нет, утверждать пустоту нельзя: каталог мог уже наполниться,
  // а запрос мог просто не дойти. Показываются тексты, верные всегда.
  it('ответа ещё нет — о пустоте не утверждается ничего', () => {
    count = undefined
    renderLanding()
    expect(screen.queryByText(/la vitrine est vide/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/n’est pas encore en ligne/i)).not.toBeInTheDocument()
  })
})
