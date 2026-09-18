import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Leaflet тянет DOM-карту и свой CSS на уровне модуля. Карта в этих
// проверках не открывается ни разу (вид по умолчанию — сетка), поэтому
// пакет заглушается целиком: иначе jsdom падает на window-зависимом коде
// ещё до самой страницы.
vi.mock('leaflet', () => ({ default: { map: vi.fn(), tileLayer: vi.fn(), marker: vi.fn(), divIcon: vi.fn() } }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

let catalogIsEmpty: boolean | undefined;

vi.mock('../../hooks/useBrowseItems', () => ({
  // Список всегда пуст: обе проверяемые ситуации — это ПУСТОЙ РЕЗУЛЬТАТ
  // витрины. Разница между ними не в нём, а в ответе на второй, безфильтровый
  // вопрос — есть ли в каталоге хоть что-нибудь.
  useBrowseItems: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
}));

vi.mock('../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({ catalogIsEmpty }),
}));

vi.mock('../../components/common/ToolDemandForm', () => ({
  default: () => <div data-testid="tool-demand-form" />,
}));

import Home from '../Home';

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe('витрина при пустом результате', () => {
  beforeEach(() => { catalogIsEmpty = undefined; });

  describe('каталог пуст', () => {
    beforeEach(() => { catalogIsEmpty = true; });

    it('говорит правду о нуле, а не винит зону', () => {
      renderHome();
      expect(screen.getByText('Le catalogue est vide')).toBeInTheDocument();
      expect(screen.queryByText('Aucun outil dans cette zone')).not.toBeInTheDocument();
    });

    it('называет отсутствие кнопки расширения вслух', () => {
      renderHome();
      expect(screen.getByText(/second écran vide/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Élargir à 50 km' })).not.toBeInTheDocument();
    });

    // Приборы настраивают ОТБОР из того, что есть. Когда нет ничего,
    // настраивать нечего, а ползунок радиуса спорит с текстом двумя строками
    // ниже, который говорит, что расширять некуда.
    it('убирает приборы над пустотой', () => {
      renderHome();
      expect(screen.queryByRole('button', { name: /À proximité/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Filtres/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Rayon de recherche')).not.toBeInTheDocument();
    });

    // Этих двух канва не называла — довод тот же. «Carte» при нуле открывает
    // пустую карту, а тап по категории приводит в тот же самый экран: орган
    // управления, который выглядит как выбор, а работает как тупик.
    it('убирает и то, до чего канва не дошла: вид и категории', () => {
      renderHome();
      expect(screen.queryByRole('group', { name: 'Affichage' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Jardinage/ })).not.toBeInTheDocument();
    });

    // Поле поиска остаётся: им человек называет искомое, и набранное
    // подставляется в форму спроса.
    it('оставляет поле поиска и спрашивает, что искали', () => {
      renderHome();
      expect(screen.getByPlaceholderText(/Rechercher/)).toBeInTheDocument();
      expect(screen.getByTestId('tool-demand-form')).toBeInTheDocument();
    });
  });

  describe('каталог не пуст, но фильтры не совпали', () => {
    beforeEach(() => { catalogIsEmpty = false; });

    it('прежний текст остаётся — он верен именно здесь', () => {
      renderHome();
      expect(screen.getByText('Aucun outil dans cette zone')).toBeInTheDocument();
      expect(screen.queryByText('Le catalogue est vide')).not.toBeInTheDocument();
    });

    it('приборы на месте: отбор настраивать есть из чего', () => {
      renderHome();
      expect(screen.getByRole('button', { name: /À proximité/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument();
    });

    it('форма спроса не показывается: вопрос уже отвечен поиском', () => {
      renderHome();
      expect(screen.queryByTestId('tool-demand-form')).not.toBeInTheDocument();
    });
  });

  // Сильное утверждение «каталог пуст» из неотвеченного запроса делать
  // нельзя: при обрыве сети человек увидел бы неправду, а органы управления
  // исчезли бы без причины.
  describe('ответа ещё нет или запрос отказал', () => {
    it('ведёт себя как «каталог не пуст»', () => {
      catalogIsEmpty = undefined;
      renderHome();
      expect(screen.getByText('Aucun outil dans cette zone')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument();
    });
  });
});
