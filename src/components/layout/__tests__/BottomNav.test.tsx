import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let user: { id: string } | null = null;

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user }),
}));

import BottomNav from '../BottomNav';

const renderAt = (path = '/') =>
  render(<MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter>);

describe('нижняя панель', () => {
  beforeEach(() => { user = { id: 'u-1' }; });

  // РАДИ ЭТОГО ОНА И ПОЯВИЛАСЬ. В навбаре у «Mes outils» и «Mes locations»
  // стоит `hide-mobile`, и правило @media (max-width:640px) убирает их на
  // каждом телефоне. Единственным входом оставалась страница конкретной вещи:
  // найти свои вещи мог только тот, кто уже нашёл одну из них.
  it('возвращает вход в «Mes locations», отнятый у телефона навбаром', () => {
    renderAt();
    expect(screen.getByRole('link', { name: /Locations/ })).toHaveAttribute('href', '/my-rentals');
  });

  it('несёт четыре раздела и действие — ровно как в канве', () => {
    renderAt();
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/my-items', '/browse', '/list-item', '/my-rentals', '/profile']);
  });

  // Единственный глагол на панели. Красный в этом продукте отдан действию
  // (правило #39), поэтому подписи у круглой кнопки нет — только доступное имя.
  it('действие названо для диктора, хотя подписи не видно', () => {
    renderAt();
    expect(screen.getByRole('link', { name: 'Déposer un outil' })).toHaveAttribute('href', '/list-item');
  });

  it('подсвечивает текущий раздел', () => {
    renderAt('/browse');
    expect(screen.getByRole('link', { name: /Parcourir/ })).toHaveClass('is-on');
    expect(screen.getByRole('link', { name: /Profil/ })).not.toHaveClass('is-on');
  });

  // «Accueil» ведёт в «Mes outils»: экрана-дашборда владельца, который канва
  // рисует под этим ярлыком, в продукте нет — по «/» открывается лендинг.
  it('«Accueil» ведёт к своим вещам, а не на лендинг', () => {
    renderAt('/my-items');
    expect(screen.getByRole('link', { name: /Accueil/ })).toHaveAttribute('href', '/my-items');
    expect(screen.getByRole('link', { name: /Accueil/ })).toHaveClass('is-on');
  });

  // Три раздела из четырёх требуют учётки. Панель, где большинство кнопок
  // отбрасывает на экран входа, хуже, чем её отсутствие.
  it('гостю не показывается вовсе', () => {
    user = null;
    const { container } = renderAt();
    expect(container).toBeEmptyDOMElement();
  });
});
