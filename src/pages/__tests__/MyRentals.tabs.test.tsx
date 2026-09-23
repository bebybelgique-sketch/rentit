import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let asRenter: Array<Record<string, unknown>> = [];
let asOwner: Array<Record<string, unknown>> = [];

// Заглушка supabase обязательна: страница тянет BookingOwnerActions →
// edgeInvoke → lib/supabase, а тот БРОСАЕТ прямо при загрузке модуля, если
// нет VITE_SUPABASE_URL. Локально переменная в .env, в CI её нет.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-1' };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useRentals', () => ({
  useRentals: () => ({ data: asRenter, isLoading: false, error: null }),
}));
vi.mock('../../hooks/useRentalsAsOwner', () => ({
  useRentalsAsOwner: () => ({ data: asOwner, isLoading: false, error: null }),
}));
// Каталог по умолчанию НЕ пуст: тогда пустой экран «Mes locations» пуст
// только из-за самих сделок, и проверки вкладок ниже не зависят от
// состояния витрины.
let catalogEmpty: boolean | undefined = false;
vi.mock('../../hooks/useCatalogHasItems', () => ({
  useCatalogHasItems: () => ({ catalogIsEmpty: catalogEmpty }),
}));
vi.mock('../../hooks/mutations/useTransitionBooking', () => ({
  useTransitionBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../components/booking/BookingThread', () => ({ default: () => null }));
// Лента событий (миграция 42): у этого набора своя забота — вкладки.
// Непрочитанного здесь нет; метки «Nouveau» проверяет свой тест.
vi.mock('../../hooks/useActivity', () => ({
  useUnreadActivity: () => ({ data: { count: 0, bookingIds: new Set<string>() } }),
  useMarkActivityRead: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../components/booking/BookingOwnerActions', () => ({ default: () => null }));

import MyRentals from '../MyRentals';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MyRentals />
    </MemoryRouter>,
  );

const booking = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  item_id: 'it-1',
  item: { title: 'Perceuse', owner: { id: 'o-1', full_name: 'Propriétaire', rating_as_owner: null } },
  renter: { id: 'r-1', full_name: 'Locataire', rating_as_renter: null },
  start_date: '2026-09-20',
  end_date: '2026-09-22',
  status: 'pending_approval',
  ...extra,
});

const tabRenter = () => screen.getByRole('tab', { name: /En tant que locataire/i });
const tabOwner = () => screen.getByRole('tab', { name: /Demandes pour mes outils/i });

describe('«Mes locations»: вкладки должны быть вкладками', () => {
  beforeEach(() => {
    asRenter = [];
    // Одна сделка на стороне владельца — чтобы вкладки вообще были.
    //
    // Посылка изменилась осознанно. Эти проверки писались, когда полоса
    // вкладок стояла всегда, в том числе на пустом экране. Так и было
    // сделано, и это оказалось неверно: пусто с обеих сторон — ОДНО
    // состояние, переключать там нечего, и вкладки заставляли человека
    // дважды убедиться, что смотреть не на что. Теперь полоса появляется
    // вместе с содержимым, а пустой случай проверяется отдельным набором
    // ниже. Сами инварианты вкладок не менялись ни один.
    asOwner = [booking('seed-owner')];
    catalogEmpty = false;
    // scrollIntoView в jsdom не реализован вовсе. Это дыра среды, а не
    // продукта: защищать вызов в MyRentals.tsx проверкой typeof значило бы
    // тащить в код обход чужого ограничения.
    Element.prototype.scrollIntoView = vi.fn();
  });

  // ГЛАВНЫЙ ИНВАРИАНТ. Прежде эти две кнопки лишь ПРОКРУЧИВАЛИ страницу:
  // обе секции всегда лежали стопкой, ни одна кнопка никогда не была
  // подсвечена. Орган управления выглядел как выбор и выбором не был.
  it('показана ровно одна сторона сделки, а не обе стопкой', () => {
    renderAt('/my-rentals');
    const renterPanel = document.getElementById('as-renter')!;
    const ownerPanel = document.getElementById('as-owner')!;
    expect(renterPanel.hasAttribute('hidden')).toBe(false);
    expect(ownerPanel.hasAttribute('hidden')).toBe(true);
  });

  it('выбранная вкладка помечена и видом, и для читалки экрана', () => {
    renderAt('/my-rentals');
    expect(tabRenter()).toHaveClass('is-on');
    expect(tabRenter()).toHaveAttribute('aria-selected', 'true');
    expect(tabOwner()).not.toHaveClass('is-on');
    expect(tabOwner()).toHaveAttribute('aria-selected', 'false');
  });

  it('нажатие переключает сторону', () => {
    renderAt('/my-rentals');
    fireEvent.click(tabOwner());
    expect(tabOwner()).toHaveClass('is-on');
    expect(document.getElementById('as-owner')!.hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('as-renter')!.hasAttribute('hidden')).toBe(true);
  });

  // Состояние живёт в адресе: ссылку на конкретную сторону можно переслать,
  // и перезагрузка не выбрасывает человека на чужой список.
  it('сторона читается из адреса', () => {
    renderAt('/my-rentals?role=owner');
    expect(tabOwner()).toHaveClass('is-on');
    expect(document.getElementById('as-owner')!.hasAttribute('hidden')).toBe(false);
  });

  // Ссылка из «Моих вещей» ведёт к КОНКРЕТНОЙ брони. Если бронь лежит на
  // стороне владельца, а по умолчанию открыта сторона арендатора, человек
  // получит «ничего нет» поверх существующей брони — ссылка станет
  // декоративной. Ровно это и было бы, реши задачу простым useState.
  it('ссылка на бронь владельца открывает сторону владельца', () => {
    asOwner = [booking('b-owner')];
    renderAt('/my-rentals?booking=b-owner');
    expect(tabOwner()).toHaveClass('is-on');
    expect(document.getElementById('booking-b-owner')).not.toBeNull();
  });

  it('ссылка на бронь арендатора оставляет сторону арендатора', () => {
    asRenter = [booking('b-renter')];
    renderAt('/my-rentals?booking=b-renter');
    expect(tabRenter()).toHaveClass('is-on');
    expect(document.getElementById('booking-b-renter')).not.toBeNull();
  });

  // Пока открыта одна сторона, ничто другое не сообщает, что на второй
  // лежит заявка на твой инструмент.
  it('счётчик на закрытой вкладке показывает, что там что-то есть', () => {
    asOwner = [booking('b-1'), booking('b-2')];
    renderAt('/my-rentals');
    expect(tabOwner().textContent).toContain('2');
  });

  // Нуля на вкладке не пишут: «0» читается как значение, а не как пустота,
  // и на полосе из двух кнопок выглядит счётом, который зачем-то показали.
  // Проверяется на РАЗНЫХ сторонах сразу: у владельца одна сделка, у
  // арендатора ни одной.
  it('нуля на вкладке не показывают — пустая вкладка молчит', () => {
    renderAt('/my-rentals');
    expect(tabOwner().textContent).toContain('1');
    expect(tabRenter().querySelector('.seg-count')).toBeNull();
  });
});

describe('«Mes locations»: пусто с обеих сторон — это ОДНО состояние', () => {
  beforeEach(() => {
    asRenter = [];
    asOwner = [];
    catalogEmpty = false;
    Element.prototype.scrollIntoView = vi.fn();
  });

  // Вкладки чинили настоящую беду, но на пустом экране создали новую:
  // человек открывал одну — «Aucune location en cours», жал вторую —
  // «Aucune demande». Две пустоты вместо одной, и ни одна не говорила,
  // ПОЧЕМУ пусто. В канве этого экрана вкладок нет вовсе.
  it('вкладок нет, когда переключать нечего', () => {
    renderAt('/my-rentals');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('вместо двух пустых списков — одна строка и одно действие', () => {
    renderAt('/my-rentals');
    expect(screen.getByText(/Aucune location, dans aucun sens/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  // Довод про пустой каталог — УТВЕРЖДЕНИЕ О СОСТОЯНИИ. Зашивать его
  // нельзя: сегодня верно, завтра врёт. Тот же класс, что зашитый ноль на
  // лендинге.
  it('пустой каталог: зовут выложить свой инструмент', () => {
    catalogEmpty = true;
    renderAt('/my-rentals');
    expect(screen.getByText(/tant que le catalogue est vide/i)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/list-item');
  });

  it('каталог не пуст: про пустой каталог НЕ говорится, зовут на витрину', () => {
    catalogEmpty = false;
    renderAt('/my-rentals');
    expect(screen.queryByText(/tant que le catalogue est vide/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/browse');
  });

  // Пока ответа о каталоге нет, берётся формулировка, верная в обоих
  // случаях: утверждать пустоту витрины наугад нельзя.
  it('ответа о каталоге нет — про каталог молчим', () => {
    catalogEmpty = undefined;
    renderAt('/my-rentals');
    expect(screen.queryByText(/tant que le catalogue est vide/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Aucune location, dans aucun sens/i)).toBeInTheDocument();
  });

  // Появилась хоть одна сделка — полоса возвращается.
  it('полоса вкладок возвращается вместе с содержимым', () => {
    asOwner = [booking('b-1')];
    renderAt('/my-rentals');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByText(/Aucune location, dans aucun sens/i)).not.toBeInTheDocument();
  });
});

/**
 * Счётчик на вкладке показывает ЖИВОЕ, а не «сколько строк за всё время».
 *
 * До 22.09 там стояло `userRentals.length` — все брони, включая
 * отменённые и завершённые. Закрыв десять сделок, человек видел «10» и
 * не понимал, чего от него хотят. Счётчик, который не уменьшается
 * никогда, не значит ничего: к нему привыкают, как к красному кружку,
 * который горит всегда.
 *
 * Прежние проверки этого не поймали бы: в их данных у всех броней стоит
 * `pending_approval`, то есть всё живое. Правило видно только там, где
 * есть история.
 */
describe('«Mes locations»: счётчик считает живое, а не историю', () => {
  beforeEach(() => {
    asRenter = [];
    asOwner = [];
    catalogEmpty = false;
  });

  it('завершённые и отменённые в счёт не идут', () => {
    asRenter = [
      booking('b-1', { status: 'completed' }),
      booking('b-2', { status: 'cancelled' }),
      booking('b-3', { status: 'rejected' }),
    ];
    renderAt('/my-rentals');
    // Три строки в списке — и ни одной в счётчике: у них нет будущего.
    expect(tabRenter().querySelector('.seg-count')).toBeNull();
  });

  it('живая бронь считается', () => {
    asRenter = [
      booking('b-1', { status: 'completed' }),
      booking('b-2', { status: 'pending_approval' }),
    ];
    renderAt('/my-rentals');
    expect(tabRenter().querySelector('.seg-count')?.textContent).toBe('1');
  });

  /**
   * У владельца на вкладке — число ДЕЛ, тем же правилом, что у значка в
   * навигации. Завершённая аренда делом не является: отзыв никого не
   * держит и не сгорает.
   */
  it('у владельца считаются дела, а не строки', () => {
    asOwner = [
      booking('o-1', { status: 'completed' }),
      booking('o-2', { status: 'pending_approval' }),
    ];
    renderAt('/my-rentals?role=owner');
    expect(tabOwner().querySelector('.seg-count')?.textContent).toBe('1');
  });
});

/**
 * «Ce qui vous attend» — первым, как «À faire maintenant» у владельца.
 *
 * До этого арендатор видел плоский список, где отменённая полгода назад
 * бронь выглядела ровно так же, как та, по которой сегодня надо ехать за
 * дрелью. Срока ответа на заявку он не видел НИГДЕ — хотя на странице
 * вещи ему обещано «владелец ответит за 24 часа».
 */
describe('«Mes locations»: что дальше — первым экраном', () => {
  beforeEach(() => {
    asRenter = [];
    asOwner = [];
    catalogEmpty = false;
  });

  it('живая бронь попадает в блок, история — нет', () => {
    asRenter = [
      booking('b-old', { status: 'completed', item: { title: 'Ponceuse', owner: { id: 'o-1', full_name: 'P', rating_as_owner: null } } }),
      booking('b-new', { status: 'pending_approval' }),
    ];
    renderAt('/my-rentals');

    const heading = screen.getByRole('heading', { name: /Ce qui vous attend/i });
    const block = heading.parentElement!;
    expect(within(block).getByText('Perceuse')).toBeInTheDocument();
    expect(within(block).queryByText('Ponceuse')).toBeNull();
  });

  it('когда живого нет, блока нет вовсе', () => {
    asRenter = [booking('b-1', { status: 'completed' })];
    renderAt('/my-rentals');
    // Заголовок над пустотой — это обещание, которого не выполняют.
    expect(screen.queryByRole('heading', { name: /Ce qui vous attend/i })).toBeNull();
  });
});
