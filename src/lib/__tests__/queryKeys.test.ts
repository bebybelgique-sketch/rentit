// src/lib/__tests__/queryKeys.test.ts
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, partialMatchKey } from '@tanstack/react-query';
import {
  adminKeys,
  bookingKeys,
  invalidateBookingCaches,
  invalidateItemCaches,
  itemKeys,
  profileKeys,
  reviewKeys,
} from '../queryKeys';

// Инвариант, который сломался до 06.09: запрос объявил ключ ['bookings',
// userId] (это были вещи!), а мутации броней инвалидировали два своих имени
// списков и мёртвый ключ занятых дат. Формально всё было «с
// ключами», а список «Моих вещей» устаревал при любом действии с другой
// страницы. Проверки ниже — про связь ключей между собой, а не про их имена:
// префикс, которым инвалидирует мутация, обязан ловить ключ запроса.
describe('queryKeys: префиксы ловят свои запросы', () => {
  it('префикс вещей ловит и витрину, и «Мои вещи»', () => {
    expect(partialMatchKey(itemKeys.list({ limit: 10 }), itemKeys.all)).toBe(true);
    expect(partialMatchKey(itemKeys.asOwner('user-1'), itemKeys.all)).toBe(true);
  });

  it('префикс броней ловит оба взгляда на таблицу bookings', () => {
    expect(partialMatchKey(bookingKeys.asRenter('user-1'), bookingKeys.all)).toBe(true);
    expect(partialMatchKey(bookingKeys.asOwner('user-1'), bookingKeys.all)).toBe(true);
  });

  it('два взгляда на брони — разные ключи, иначе владелец видел бы свои заявки арендатором', () => {
    expect(bookingKeys.asRenter('user-1')).not.toEqual(bookingKeys.asOwner('user-1'));
  });

  it('«Мои вещи» больше не живут в префиксе броней', () => {
    expect(partialMatchKey(itemKeys.asOwner('user-1'), bookingKeys.all)).toBe(false);
  });

  it('префикс отзывов ловит обе роли', () => {
    expect(partialMatchKey(reviewKeys.list('user-1', 'owner'), reviewKeys.of('user-1'))).toBe(true);
    expect(partialMatchKey(reviewKeys.list('user-1', 'renter'), reviewKeys.of('user-1'))).toBe(true);
    // Чужой человек — не тот же префикс.
    expect(partialMatchKey(reviewKeys.list('user-2', 'owner'), reviewKeys.of('user-1'))).toBe(false);
  });

  it('карточка вещи НЕ ловится префиксом списков — исключение, ради которого у инвалидации есть itemId', () => {
    expect(partialMatchKey(itemKeys.one('item-1'), itemKeys.all)).toBe(false);
  });

  it('профиль и админ-счётчики не пересекаются с вещами и бронями', () => {
    expect(partialMatchKey(profileKeys.one('user-1'), itemKeys.all)).toBe(false);
    expect(partialMatchKey(adminKeys.stats, bookingKeys.all)).toBe(false);
  });
});

describe('queryKeys: что именно инвалидируют помощники', () => {
  it('invalidateBookingCaches бьёт по броням и вещам — и только по ним', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateBookingCaches(queryClient);

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all });
    // Ровно два: мёртвый ключ занятых дат (его инвалидировали четыре мутации,
    // а не объявлял ни один запрос) и прежние два имени списков броней сюда
    // вернуться не могут — число вызовов зафиксировано.
  });

  it('invalidateItemCaches без id трогает только списки', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateItemCaches(queryClient);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all });
  });

  it('invalidateItemCaches с id добавляет карточку вещи', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateItemCaches(queryClient, 'item-1');

    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.one('item-1') });
  });
});
