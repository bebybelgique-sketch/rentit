import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * Первый экран лендинга.
 *
 * 05.10 решение о первом экране поменялось: был владелец («Vos outils
 * dorment», главная кнопка — выкладка), стал поиск «что, где, когда» — его
 * выбрал Рамзан 04.10. Тесты на прежнее решение упали правильно; ниже —
 * что стало с каждым инвариантом, а не молчаливая подгонка строк.
 *
 * «Главное действие ведёт на выкладку» → СНЯТ вместе с решением. Вместо
 *   него два: поиск ведёт на витрину РАБОЧИМИ параметрами (их читает
 *   Home.tsx), и путь владельца остаётся на первом экране при любом ответе
 *   каталога.
 * «Витрина — вторым действием» → снят тем же решением.
 * «Пустота названа прямо» и «число считается, а не пишется» → ДЕРЖИМ без
 *   изменений: 0, 1, 7 и «ответа нет».
 * «Снимок подписан как иллюстративный» → инвариант тот же, носитель другой:
 *   на витрину похожа не фотография с дрелью, а карточка объявления в
 *   коллаже. Она и подписана «Exemple d’annonce», а коллаж скрыт от чтения
 *   с экрана.
 */

let count: number | undefined = 0

vi.mock('../../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({
    data: count,
    catalogIsEmpty: count === undefined ? undefined : count === 0,
  }),
}))

import HeroSection from '../HeroSection'

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname + loc.search}</p>
}

const renderHero = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<HeroSection />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
)

const submit = () => fireEvent.click(screen.getByRole('button', { name: /rechercher/i }))

describe('первый экран лендинга', () => {
  beforeEach(() => { count = 0 })

  it('поиск ведёт на витрину с тем, что человек ввёл', () => {
    renderHero()
    fireEvent.change(screen.getByLabelText('Quoi ?'), { target: { value: 'perceuse' } })
    fireEvent.change(screen.getByLabelText('Où ?'), { target: { value: 'Walhain' } })
    submit()
    expect(screen.getByTestId('where')).toHaveTextContent('/browse?q=perceuse&where=Walhain')
  })

  it('«Ce week-end» превращается в настоящие даты витрины', () => {
    renderHero()
    fireEvent.change(screen.getByLabelText('Quand ?'), { target: { value: 'this' } })
    submit()
    expect(screen.getByTestId('where').textContent).toMatch(/^\/browse\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)
  })

  it('пустой поиск — просто витрина, без пустых параметров', () => {
    renderHero()
    submit()
    expect(screen.getByTestId('where').textContent).toBe('/browse')
  })

  it('чипы задач ведут на категории каталога, и подписи не сырые ключи', () => {
    renderHero()
    const nav = screen.getByRole('navigation', { name: /par usage/i })
    const links = Array.from(nav.querySelectorAll('a'))
    expect(links).toHaveLength(6)
    expect(links[0]).toHaveAttribute('href', '/browse?category=power_tools')
    expect(links[0]).toHaveTextContent('Percer, visser')
    for (const a of links) expect(a.textContent).not.toMatch(/categoryTasks\./)
  })

  it('путь владельца на первом экране: при пустом каталоге — «le premier»', () => {
    renderHero()
    expect(screen.getByRole('link', { name: /déposez le premier/i })).toHaveAttribute('href', '/list-item')
  })

  it('путь владельца остаётся и без ответа каталога', () => {
    count = undefined
    renderHero()
    expect(screen.getByRole('link', { name: /déposez-le/i })).toHaveAttribute('href', '/list-item')
  })

  it('пустота витрины названа прямо', () => {
    renderHero()
    expect(screen.getByText(/0 outil en ligne/i)).toBeInTheDocument()
  })

  it('на непустом каталоге — настоящее число, и «le premier» снимается', () => {
    count = 7
    renderHero()
    expect(screen.getByText(/7 outils en ligne/i)).toBeInTheDocument()
    expect(screen.queryByText(/0 outil en ligne/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/déposez le premier/i)).not.toBeInTheDocument()
  })

  // Множественное число считает библиотека: во французском «one» покрывает
  // и 0, и 1, и вручную это правило повторять нельзя.
  it('одна вещь — единственное число', () => {
    count = 1
    renderHero()
    expect(screen.getByText(/^1 outil en ligne/i)).toBeInTheDocument()
  })

  it('пока ответа нет, о числе не говорится ничего', () => {
    count = undefined
    renderHero()
    expect(screen.queryByText(/en ligne aujourd/i)).not.toBeInTheDocument()
    // Остальной экран на месте: скрыт один блок, а не страница.
    expect(screen.getByRole('search')).toBeInTheDocument()
  })

  it('карточка в коллаже подписана как пример, коллаж скрыт от чтения', () => {
    const { container } = renderHero()
    const art = container.querySelector('.lp-art')!
    expect(art).toHaveAttribute('aria-hidden', 'true')
    expect(art).toHaveTextContent(/exemple d’annonce/i)
    // Снимки коллажа — оформление: пустой alt, а не описание «вещи».
    for (const img of Array.from(art.querySelectorAll('img'))) expect(img).toHaveAttribute('alt', '')
  })
})
