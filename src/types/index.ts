import type { BookingStatusValue } from '../domain/catalog';

// Здесь был выдуманный интерфейс Database с таблицами `rentals` и `profiles`.
// Таких таблиц в базе НЕТ (проверено обращением к живой базе 10.08.2026:
// оба имени отдают 404). Настоящие: items, bookings, users, reviews, payments,
// events. Блок удалён, чтобы он больше никого не вводил в заблуждение.

// src/types/supabase.ts пока заглушка (одни комментарии), поэтому импорта из него нет.

// Определяем типы, которые могут быть переопределены или расширены сгенерированными типами
// Если файл supabase.ts пуст или не содержит нужных типов, используются эти.

// Тип для Item. Может быть заменен на Tables<'items'>['Row'] из supabase.ts
export interface Item {
  id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  owner_id: string;
  // Адрес объявления одной строкой, как его ввёл владелец. Колонка так и
  // называется — `address`. Прежде поле звалось `location`, и это было не
  // просто другое имя: в таблице items ЕСТЬ колонка `location`, но она
  // geography (generated always as ST_SetSRID(ST_MakePoint(lng, lat))) и
  // читается PostGIS-запросами, а не как текст. Одинаковое имя для точки на
  // карте и для строки «Wavre, BE» — заготовленная путаница: любой, кто
  // возьмёт `location` из ответа базы, получит бинарную геометрию и вызовет
  // на ней .split(',').
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_available: boolean;
  created_at: string;
  // Снимки объявления. В базе это jsonb, а не массив строк, и после
  // supabase gen types поле станет Json — читать его надо через
  // `photosOf` из src/lib/items.ts, а не индексом.
  //
  // Поля `image_url` здесь больше нет: колонки с таким именем в items не
  // существует, а вычислялось оно тремя одинаковыми строчками в трёх
  // хуках. Обложка — `coverPhoto(item)`.
  // Колонки, которые есть в таблице items и используются формами:
  deposit?: number;
  category?: string;
  condition?: string;
  photos?: string[];
  // Тарифы на срок и объявленная плата за просрочку. `null` — владелец их не
  // назначил, и тогда счёт идёт по дневной цене. Платформа эти суммы не
  // держит и не считает: расчёт наличными между сторонами.
  price_3days?: number | null;
  price_week?: number | null;
  late_fee_per_day?: number | null;
  // Доступность (миграция 20260817000022): количество одинаковых единиц,
  // зазор после возврата, срок предупреждения. Саму занятость по ним
  // считает база — см. `src/domain/availability.ts`.
  quantity?: number;
  buffer_days?: number;
  min_notice_days?: number;
  // Доставка (миграция 20260819000024). delivery_fee — ЕДИНСТВЕННЫЙ признак
  // того, что владелец доставляет: пусто — услуги нет, и вторая сторона не
  // видит про неё ни строчки. Отдельного флага «включено» нет намеренно: два
  // поля рядом расходятся. Сумму платформа не держит и не считает — расчёт
  // при встрече, как с платой за просрочку.
  delivery_fee?: number | null;
  delivery_radius_km?: number | null;
}

/** Перерыв, объявленный владельцем: отпуск, ремонт, вещь занята для себя. */
export interface ItemBlackout {
  id: string;
  item_id: string;
  start_date: string;
  end_date: string;
  // Заметка видна ТОЛЬКО владельцу: «в отпуске до 20-го» — про него, а не
  // про вещь. Наружу уходит один факт — день недоступен.
  note: string | null;
  created_at: string;
}

// Краткая карточка человека — то, что одна сторона сделки вправе знать о
// другой: как зовут, как выглядит, как его оценивали. Телефон и почта сюда
// не входят: договариваются стороны в переписке по броне.
export interface PartyProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  rating_as_owner?: number | null;
  rating_as_renter?: number | null;
}

// Строка таблицы bookings. Имя `Rental` историческое (таблицы `rentals` в
// базе нет — проверено 10.08.2026, имя отдаёт 404), но менять его сейчас
// значило бы переименовать все хуки разом; это отдельный шаг.
//
// Второго типа для этой же строки быть не должно. До 05.09 он был:
// MyItems.tsx держал свой `interface Booking` со `status: string` и без
// половины колонок, и статусы в нём не проверялись ничем. Схождение
// проверяется наличием ровно одного объявления на таблицу.
export interface Rental {
  id: string;
  item_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  // Колонка generated always as (end_date - start_date + 1) stored: считает
  // её база, клиент только читает. Необязательное — не всякий запрос её
  // выбирает.
  total_days?: number;
  total_price: number;
  // Значения строго из enum booking_status в базе (сверено 10.08.2026).
  // Список живёт в одном месте — src/domain/catalog.ts, там же подписи и
  // цвета бейджей; дублировать его здесь значило бы завести вторую правду
  // о том, какие статусы бывают.
  status: BookingStatusValue;
  // Столбец в базе называется request_message. Поля message в bookings нет
  // и не было: страница выводила `rental.message` и показывала пустоту.
  request_message?: string | null;
  created_at: string;
  // Отмена: кто, когда и почему (миграция 20260811000011).
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  // Доставка: выбор арендатора и СНИМОК цены на момент заявки. Снимок, а не
  // текущее значение вещи — правка цены владельцем не меняет условий уже
  // созданной брони. В total_price не входит.
  delivery_requested?: boolean;
  delivery_fee?: number | null;
  // Вещь приходит под псевдонимом item (в запросе: `item:items(...)`),
  // вместе с профилем владельца — иначе арендатор не знает, к кому едет.
  item?: Item & { owner?: PartyProfile | null };
  // Вторая сторона сделки в списке владельца.
  renter?: PartyProfile | null;
}

// Профиль = строка таблицы users (id совпадает с auth.uid()).
// Поля сверены со схемой 10.08.2026; поля bio в базе нет.
export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone?: string | null;
  village?: string | null;
}

// Если файл supabase.ts содержит эквивалентные типы, их можно экспортировать напрямую:
// export type { Item as SupabaseItem, Rental as SupabaseRental, Profile as SupabaseProfile } from './supabase';