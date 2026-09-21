// src/components/items/__tests__/ItemCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ItemCard from '../ItemCard';
import type { Item } from '../../../types';

// Заготовка объявлена типом строки таблицы, а не «похожим объектом»: с
// 06.09 `Item` — это `Tables<'items'>`, и `condition` в нём enum из базы
// ('new' | 'like_new' | 'good' | 'fair'), а не string. Без аннотации
// фикстура компилировалась, пока тип был написан руками, и перестала —
// как только тип стал выводиться из схемы. Это и есть работа типа:
// значение 'tools'/'good' проверяется по базе, а не на глаз.
//
// `category` заодно приведена к настоящему значению справочника: 'tools' в
// продукте нет и никогда не было (см. комментарий в src/domain/catalog.ts).
const mockItem: Item = {
  id: '1',
  owner_id: 'owner1',
  title: 'Test Drill',
  description: 'A powerful drill',
  category: 'power_tools',
  condition: 'good',
  price_per_day: 25,
  price_3days: 60,
  price_week: 140,
  late_fee_per_day: 5,
  deposit: 30,
  photos: ['https://example.com/drill.jpg'],
  lat: 50.8503,
  lng: 4.3517,
  address: 'Brussels, BE',
  available: true,
  quantity: 1,
  buffer_days: 2,
  min_notice_days: 1,
  delivery_fee: null,
  delivery_radius_km: null,
  created_at: '2023-01-01T00:00:00Z',
  location: null,
  is_business: false,
};

describe('ItemCard', () => {
  it('renders item title and price', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItem} />
      </MemoryRouter>
    );

    expect(screen.getByText(mockItem.title)).toBeInTheDocument();
    expect(screen.getByText(`€${mockItem.price_per_day}/jour`)).toBeInTheDocument();
  });

  it('renders a fallback image if no photos are provided', () => {
    const itemWithoutImage = { ...mockItem, photos: [] };
    render(
      <MemoryRouter>
        <ItemCard item={itemWithoutImage} />
      </MemoryRouter>
    );

    // Инвариант прежний: без снимка на месте картинки стоит ЗАПОЛНИТЕЛЬ, а не
    // пустота и не битая картинка. Изменилась только его реализация — был 🔧
    // текстом, стал CategoryIcon. Значок помечен aria-hidden (он декоративный,
    // рядом есть название), поэтому ищется как svg, а не по роли или тексту.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('.item-card-img svg, svg')).toBeInTheDocument();
  });

  it('renders the provided image if photos are present', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItem} />
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: mockItem.title })).toBeInTheDocument();
  });

  // В базе photos — это jsonb: внутри может оказаться null или объект.
  // Такой элемент не должен доехать до src картинки пустой строкой —
  // отсюда фильтрация в photosOf, а не просто photos[0].
  it('мусор внутри photos не превращается в битую картинку', () => {
    // Приведение `as unknown as string[]` снято: в базе photos — jsonb, в
    // типе — `Json`, и мусорный массив законен сам по себе. Приведение
    // обещало компилятору «это массив строк» ровно там, где это неправда.
    const itemWithJunk: Item = { ...mockItem, photos: [null, '', { url: 'x' }] };
    render(
      <MemoryRouter>
        <ItemCard item={itemWithJunk} />
      </MemoryRouter>
    );

    // Тот же инвариант, что выше: мусор в photos приводит к заполнителю, а не
    // к картинке с пустым src.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
  /**
   * Отложенная загрузка картинки в карточке.
   *
   * ЗАЧЕМ ЗДЕСЬ, А НЕ В БРАУЗЕРЕ. Проверить это на живой витрине не на
   * чем: объявлений в проде нет, и прогон честно показал «картинок: 0».
   * Здесь данные задаю я, и проверка не зависит от того, выложил ли
   * кто-нибудь вещь.
   *
   * ПОЧЕМУ ИМЕННО В СПИСКЕ. Человек видит три карточки, а грузится
   * двадцать. Над сгибом приём вредит: снимок на входе откладывать
   * НЕЛЬЗЯ, он и есть главный элемент первого экрана.
   */
  it('картинка в списке грузится отложенно', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItem} />
      </MemoryRouter>
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('loading')).toBe('lazy');
    // Разбор картинки — вне основного потока: иначе он подтормаживает
    // прокрутку ровно в тот момент, когда человек листает список.
    expect(img.getAttribute('decoding')).toBe('async');
  });
});