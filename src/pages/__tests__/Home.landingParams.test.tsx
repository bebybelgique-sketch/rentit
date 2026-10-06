import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BrowseFilters } from '../../hooks/useBrowseItems';

// Поиск первого экрана кладёт ответы в адрес витрины: ?q, ?where и
// ?from/?to. Дважды уже было так, что лендинг слал параметр, а витрина его
// не читала (?where=, ?category=): поле выглядело рабочим и молча ничего не
// делало. Здесь проверяется, что каждый параметр ДОХОДИТ до запроса.

vi.mock('leaflet', () => ({ default: { map: vi.fn(), tileLayer: vi.fn(), marker: vi.fn(), divIcon: vi.fn() } }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

let lastFilters: BrowseFilters | undefined;

vi.mock('../../hooks/useBrowseItems', () => ({
  useBrowseItems: (f: BrowseFilters) => {
    lastFilters = f;
    return { data: [], isPending: false, isError: false, refetch: vi.fn() };
  },
}));

vi.mock('../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({ catalogIsEmpty: false }),
}));

vi.mock('../../components/common/ToolDemandForm', () => ({
  default: () => <div data-testid="tool-demand-form" />,
}));

import Home from '../Home';

const open = (url: string) => render(<MemoryRouter initialEntries={[url]}><Home /></MemoryRouter>);

describe('витрина читает поиск с лендинга', () => {
  beforeEach(() => { lastFilters = undefined; });

  it('что, где и даты доходят до запроса', () => {
    open('/browse?q=perceuse&where=Walhain&from=2026-10-10&to=2026-10-11');
    expect(lastFilters).toMatchObject({
      search: 'perceuse', place: 'Walhain', startDate: '2026-10-10', endDate: '2026-10-11',
    });
  });

  it('один день (воскресенье) — тоже диапазон', () => {
    open('/browse?from=2026-10-11&to=2026-10-11');
    expect(lastFilters).toMatchObject({ startDate: '2026-10-11', endDate: '2026-10-11' });
  });

  it('несуществующий день не принимается', () => {
    open('/browse?from=2026-02-31&to=2026-03-01');
    expect(lastFilters).toMatchObject({ startDate: '', endDate: '' });
  });

  it('конец раньше начала — конец отброшен, а не перевёрнут молча', () => {
    open('/browse?from=2026-10-11&to=2026-10-10');
    expect(lastFilters).toMatchObject({ startDate: '2026-10-11', endDate: '' });
  });
});
