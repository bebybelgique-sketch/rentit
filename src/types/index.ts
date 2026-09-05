// src/types/index.ts
//
// Типы приложения — это схема базы, а не её пересказ.
//
// ЗАЧЕМ. До 05.09 `Item`, `Rental` и `Profile` были написаны руками и
// разошлись с базой: `image_url` против jsonb-колонки `photos`,
// `latitude`/`longitude` против `lat`/`lng`, `is_available` против
// `available`. Расхождения находили в проде. Форма редактирования однажды
// отправила выдуманное поле в UPDATE, и PostgREST отклонил запрос ЦЕЛИКОМ
// (PGRST204, «Could not find the 'image_url' column») — страница не сохранила
// ни цену, ни описание.
//
// Первый шаг (05.09) убрал явные приведения к типу Item, сделав все поля
// необязательными, а `photos`/`location` — `unknown`. Стало тише, но не
// честнее: связь со схемой осталась обещанием, а не выводом. Исчезни колонка
// в базе — `tsc` промолчал бы, потому что поле и так необязательное. Дрейф,
// ради которого затевался `npm run generate-types`, не ловился.
//
// Теперь каждый тип строки — это `Tables<'…'>` из сгенерированного файла.
// Править этот файл руками можно ровно в одном случае: нужна ПРОЕКЦИЯ —
// связка строк, которую PostgREST собирает по select-строке хука. Проекции
// ниже собраны из `Pick`/`Omit` тех же сгенерированных типов: переименование
// или удаление колонки ломает сборку здесь, а не показывает undefined на
// экране.
//
// `database.types.ts` руками не правится никогда — только
// `npm run generate-types` (см. src/lib/generate-types.sh).

import type { Database, Tables } from './database.types';

/* ─────────────────────────── Enum'ы базы ─────────────────────────── */

/**
 * Значения `public.booking_status`.
 *
 * Объявление ЕДИНСТВЕННОЕ. Второе жило в `src/domain/catalog.ts` и выводилось
 * из набранной руками таблицы `BOOKING_STATUSES`: наборы совпадали, но связи
 * между ними не было, и новое значение в базе скомпилировалось бы молча.
 * Теперь справочник подписей закреплён за этим типом через `satisfies` и
 * проверку исчерпываемости — расхождение ломает сборку.
 */
export type BookingStatusValue = Database['public']['Enums']['booking_status'];

/** Значения `public.item_condition` — та же история, что и со статусами. */
export type ItemConditionValue = Database['public']['Enums']['item_condition'];

/* ────────────────────────── Строки таблиц ────────────────────────── */

/** Объявление: строка таблицы `items`. */
export type Item = Tables<'items'>;

/** Бронь: строка таблицы `bookings`. В продукте она зовётся «арендой». */
export type Rental = Tables<'bookings'>;

/** Перерыв владельца: строка таблицы `item_blackouts`. */
export type ItemBlackout = Tables<'item_blackouts'>;

/**
 * Профиль — строка `users` БЕЗ колонки, которую клиент читать не вправе.
 *
 * Миграция 20260905000027 выдала anon/authenticated право SELECT не на
 * таблицу, а поимённо на 16 столбцов; 20260905000028 повторила тот же список
 * и отдельно сняла `phone`, `lat`, `lng`. `phone_otp`, `phone_otp_expires_at`
 * и `stripe_customer_id` не выдавались никогда — ради них табличное право и
 * снимали (миграция 20260328000007).
 *
 * Поэтому здесь `Pick`, а не `Tables<'users'>`: полный алиас описывал бы
 * строку, которую PostgREST не отдаст. Тип обещал бы больше, чем разрешает
 * база, — та же болезнь, что и `image_url`, только в другую сторону. Если
 * грант изменится, менять надо этот список, и изменение будет видно в ревью.
 */
export type Profile = Pick<
  Tables<'users'>,
  | 'id'
  | 'full_name'
  | 'avatar_url'
  | 'phone_verified'
  | 'village'
  | 'role'
  | 'referral_code'
  | 'referred_by'
  | 'rating_as_owner'
  | 'rating_as_renter'
  | 'is_pro'
  | 'pro_expires_at'
  | 'business_name'
  | 'business_plan'
  | 'business_plan_expires_at'
  | 'created_at'
>;

/**
 * Четыре колонки, которые действительно приходят из `useProfile` и
 * `useUpdateProfile`: оба запроса перечисляют столбцы поимённо
 * (`'id, full_name, avatar_url, village'`) — пустой `.select()` ушёл бы как
 * `select=*` и получил 403 на табличном праве.
 *
 * `Pick` от `Profile`, а не от `Tables<'users'>`: если колонку отзовут,
 * проекция отвалится вместе с грантом, а не после 42501 в консоли.
 */
export type ProfileSummary = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'village'>;

/**
 * Чужой профиль в том объёме, в каком его показывают другому человеку.
 *
 * Обязательны только три колонки, которые запрашивает каждый join; рейтинг,
 * галочка телефона и признак про-аккаунта — `Partial`, потому что разные
 * связки просят разное: владельцу вещи нужен `rating_as_owner`, арендатору —
 * `rating_as_renter`, а список вещей владельца не спрашивает ни того, ни
 * другого. Выдумывать под каждую связку свой тип — значит размножить то, что
 * мы только что собрали в одно место.
 */
export type PartyProfile = Pick<Profile, 'id' | 'full_name' | 'avatar_url'> &
  Partial<Pick<Profile, 'rating_as_owner' | 'rating_as_renter' | 'phone_verified' | 'is_pro'>>;

/* ───────────────────── Строки функций базы ───────────────────── */

/**
 * Строка витрины: то, что возвращает `browse_items`.
 *
 * Объявлять её руками нельзя, и до 06.09 на витрине жили ДВА самодельных
 * типа — `BrowseRow` («как должно приходить») и локальный `interface Item`
 * («как удобно рисовать»), а между ними стояло приведение
 * `(data || []) as BrowseRow[]`. Приведение обещало форму, которую никто не
 * проверял: расхождение с функцией дало бы не отказ сборки, а пустые карточки.
 * Здесь обе половины — из сгенерированной схемы.
 */
export type BrowseRow = Database['public']['Functions']['browse_items']['Returns'][number];

/** Аргументы `browse_items`. Все необязательны — так их объявила функция. */
export type BrowseArgs = Database['public']['Functions']['browse_items']['Args'];

/* ─────────────── Проекции связок (select-строки хуков) ─────────────── */

/**
 * Бронь со связками — взгляд АРЕНДАТОРА (`useRentals`):
 * `'*, item:items(*, owner:users!owner_id(…))'`.
 *
 * Псевдоним `item` — часть запроса, а не украшение типа: без псевдонима
 * PostgREST кладёт связь под именем таблицы («items»), а страница читает
 * `rental.item` и получает undefined — «N/A» вместо названия вещи.
 *
 * `item` может быть null: связь левая, вещь могла быть удалена. Объявить её
 * обязательной — значит научить страницу падать.
 */
export type RentalWithItemOwner = Rental & {
  item: (Item & { owner: PartyProfile | null }) | null;
};

/**
 * Бронь со связками — взгляд ВЛАДЕЛЬЦА вещи (`useRentalsAsOwner`):
 * `'*, item:items!inner(*), renter:users!renter_id(…)'`.
 *
 * ДВЕ проекции вместо одной общей — намеренно. Один тип
 * `Rental & { item, renter, item.owner }` был бы ложью для обоих хуков:
 * арендатору профиль арендатора не запрашивается (это он сам), а владельцу —
 * профиль владельца вещи (это он сам). Общая проекция с необязательными
 * полями вернула бы ровно то, от чего мы уходим: хук забыл связку — компилятор
 * промолчал, страница показала «Utilisateur». Здесь каждый тип описывает
 * ровно то, что приходит по его select-строке.
 *
 * `item` обязателен: join помечен `!inner`, строки без вещи не приходит.
 */
export type RentalWithRenter = Rental & {
  item: Item;
  renter: PartyProfile | null;
};

/**
 * Бронь в списке вещей владельца: проекция, а не полная строка.
 * `useOwnerItems` просит у базы десять колонок брони — объявлять здесь
 * `Rental` значило бы пообещать `amount_paid` и `stripe_payment_intent_id`,
 * которых в ответе нет.
 */
export type OwnerBooking = Pick<
  Rental,
  | 'id'
  | 'item_id'
  | 'renter_id'
  | 'status'
  | 'start_date'
  | 'end_date'
  | 'total_price'
  | 'total_days'
  | 'request_message'
  | 'created_at'
> & { renter: PartyProfile | null };

/** Вещь владельца вместе с её бронями (`useOwnerItems`). */
export type OwnerItem = Item & { bookings: OwnerBooking[] };
