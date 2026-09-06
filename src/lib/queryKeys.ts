// src/lib/queryKeys.ts
//
// Ключи кэша react-query — в одном месте.
//
// ЗАЧЕМ ЭТОТ ФАЙЛ. До 06.09 каждый хук набирал ключ строкой у себя, и
// мутации инвалидировали то, что запомнили. Получилось три разрыва:
//
//   • `useOwnerItems` объявлял ['bookings', userId] — ключ, названный не тем
//     словом (это вещи, а не брони), и НИ ОДНА мутация его не инвалидировала.
//     Список «Моих вещей» держался на ручных setQueryData внутри страницы:
//     подтверди бронь из /my-rentals — владелец видел устаревшую заявку, пока
//     не обновит страницу руками;
//   • два списка броней (взгляд арендатора и взгляд владельца) были разными
//     ключами с разными именами, и мутация, забывшая один из них, молчала;
//   • ключ занятых дат инвалидировали четыре мутации, а не объявлял ни один
//     запрос — мёртвый ключ с прошлого спринта (имя его живёт в сообщении
//     коммита; в коде его больше нет, и проверка ниже не даст ему вернуться).
//
// Правило, которое файл делает исполнимым: ЗАПРОС объявляет ключ отсюда,
// МУТАЦИЯ инвалидирует префикс отсюда. Ключ, набранный литералом в
// компоненте, не инвалидируется ничем — ровно это и случилось с
// ['bookings', userId].
//
// Префиксы: инвалидация ['items'] задевает и витрину (list), и «Мои вещи»
// (asOwner); ['bookings'] — и взгляд арендатора, и взгляд владельца.
// Единственное исключение — itemKeys.one: он в единственном числе
// (['item', id]) исторически, и префикс ['items'] его НЕ задевает. Поэтому
// мутации, меняющие одну вещь, инвалидируют его поимённо (см.
// useUpdateItem, useAdminAction, useDeleteItem).

import type { QueryClient } from '@tanstack/react-query';

/** Вещи (таблица items) и одна вещь. */
export const itemKeys = {
  /** Префикс всех списков вещей. */
  all: ['items'],
  /** Витрина с фильтрами (useItems). */
  list: (params?: { limit?: number; sortBy?: string; search?: string }) => ['items', params],
  /**
   * Витрина: все фильтры в ключе. Ключ, в который не вошёл фильтр, — это
   * кэш, который не обновится при его изменении (или обновится, когда не
   * надо): поэтому объект целиком, а не «основные» поля.
   */
  browse: (filters: Record<string, unknown>) => ['items', 'browse', filters],
  /** Вещи владельца вместе с бронями (useOwnerItems). */
  asOwner: (userId: string | undefined) => ['items', 'asOwner', userId],
  /** Одна вещь (useItemById). Единственное число — см. шапку файла. */
  one: (id: string | undefined) => ['item', id],
} as const;

/** Брони (таблица bookings) — оба взгляда на одну таблицу. */
export const bookingKeys = {
  /** Префикс обоих списков. */
  all: ['bookings'],
  /** Брони, где человек арендатор (useRentals). */
  asRenter: (userId: string | undefined) => ['bookings', 'asRenter', userId],
  /** Брони вещей человека как владельца (useRentalsAsOwner). */
  asOwner: (userId: string | undefined) => ['bookings', 'asOwner', userId],
  /** Переписка по брони (useBookingMessages). */
  messages: (bookingId: string | undefined) => ['bookingMessages', bookingId],
  /** Фотографии передачи (useBookingPhotos). */
  photos: (bookingId: string | undefined) => ['bookingPhotos', bookingId],
} as const;

/** Профиль (строка users). */
export const profileKeys = {
  all: ['profile'],
  one: (userId: string | undefined) => ['profile', userId],
} as const;

/**
 * Отзывы о человеке. `of` — префикс для инвалидации (отзывы в обеих ролях),
 * `list` — ключ конкретного запроса. Совместить их нельзя: react-query
 * сопоставляет ключи ПОЭЛЕМЕНТНО, и ['userReviews', id, undefined] не совпал
 * бы с ['userReviews', id, 'owner'] — инвалидация прошла бы мимо.
 */
export const reviewKeys = {
  of: (userId: string | undefined) => ['userReviews', userId],
  list: (userId: string | undefined, role: string | undefined) => ['userReviews', userId, role],
} as const;

/** Админ-панель. */
export const adminKeys = {
  stats: ['admin', 'stats'],
} as const;

/**
 * Состояние брони изменилось — значит устарели ОБА списка броней (арендатор
 * и владелец смотрят на одну строку) и списки вещей: заявка видна владельцу в
 * «Моих вещах», а занятость дат — на витрине.
 *
 * Одна функция на четыре мутации намеренно: до неё каждая мутация держала свой
 * набор ключей, и наборы разошлись (useCreateRental не знал про
 * ['rentalsAsOwner'], а про ['bookings', userId] не знал никто). Здесь
 * расхождение невозможно — список один.
 */
export function invalidateBookingCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  void queryClient.invalidateQueries({ queryKey: itemKeys.all });
}

/**
 * Вещь изменилась (цена, доступность, удаление): устарели списки вещей и
 * карточка одной вещи.
 */
export function invalidateItemCaches(queryClient: QueryClient, itemId?: string): void {
  void queryClient.invalidateQueries({ queryKey: itemKeys.all });
  if (itemId) void queryClient.invalidateQueries({ queryKey: itemKeys.one(itemId) });
}
