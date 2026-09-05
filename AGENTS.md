# Правила работы в этом репозитории

Файл для ИИ-агентов, пишущих код в RentIt. Всё ниже проверено обращением к
живой базе и чтением схемы 10.08.2026 — это не предположения.

---

## 1. Как работать с файлами

**Новые файлы — можно. Существующие — только точечная правка.**

Никогда не переписывай существующий файл целиком «по памяти». Именно так за
одну сессию дважды был сломан `App.tsx`: пропали импорты `lazy`, `Suspense`,
`useState`, которые файл использует 18 раз, и дважды затёрлась чужая починка.
Меняй конкретные строки, остальное не трогай.

**`package.json` руками не редактировать.** Это строгий JSON — комментарии
`// ...` делают файл нечитаемым, и тогда не работает ничего: ни `npm install`,
ни сборка, ни тесты. Нужна зависимость — назови её в ответе словами.

**Начатое доводи до конца или не начинай.** Половина миграции хуже, чем её
отсутствие: в `ItemDetail.tsx` были добавлены импорты четырёх хуков и ссылки на
их результаты, но сами хуки не вызваны — файл пришлось откатывать целиком.

**Не отчитывайся о том, чего не проверял.** У тебя нет терминала: ты не можешь
знать, собирается ли код. Пиши «изменены такие-то файлы», а не «проверено» или
«готово к работе».

---

## 2. Пять механических правил

1. **JSX только в `.tsx`.** Файл `.ts` с разметкой не парсится. За день эта
   ошибка повторилась пять раз в тестах.
2. **`vi.mock` — только на верхнем уровне модуля.** Vitest поднимает его в
   начало файла, поэтому переменные, объявленные внутри `it()`, в момент
   исполнения фабрики ещё не существуют. Данные для мока — через `vi.hoisted()`.
   Из-за этого падают 15 тестов из 20.
3. **Считай глубину относительных путей.** Из `src/hooks/mutations/` до
   `src/lib` — это `../../`, а из `src/hooks/mutations/__tests__/` — `../../../`.
   Ошибка здесь роняет сборку целиком.
4. **Не изобретай модули и таблицы.** Если не знаешь имени — спроси, а не
   предполагай. Комментарий «предполагаем, что таблица называется…» = ошибка.
5. **Не создавай файл, который затеняет существующую папку.** `src/i18n.ts`
   рядом с папкой `src/i18n/` перехватывает все импорты `./i18n` и ломает их.

---

## 3. Настоящая схема базы

Таблицы: **`items`, `bookings`, `users`, `reviews`, `payments`, `events`**.

**Таблиц `rentals` и `profiles` НЕ существует** — оба имени отдают 404.
Аренда — это `bookings`. Профиль — это `users` (её `id` = `auth.uid()`).

```
items     id, owner_id, title, description, category, condition, price_per_day,
          deposit, photos (jsonb), lat, lng, address, available, created_at

bookings  id, item_id, renter_id, start_date, end_date, total_days (generated),
          total_price, deposit_amount, platform_fee, status, amount_paid,
          stripe_payment_intent_id, deposit_returned, created_at

users     id, full_name, avatar_url, phone, phone_verified, village, lat, lng,
          role, referral_code, referred_by, rating_as_owner, rating_as_renter,
          created_at          -- поля bio НЕТ, email НЕТ

reviews   id, booking_id, from_user_id, to_user_id, item_id, review_type,
          rating, comment, created_at
```

**enum `booking_status`** — других значений не бывает:
`pending_approval`, `pending_payment`, `confirmed`, `active`, `completed`,
`cancelled`, `disputed`, `rejected`, `expired`, `payment_expired`.

Значений `pending`, `approved`, `canceled` в базе нет — запись с ними падает.

**`total_price` в `bookings` — snapshot на момент заявки; никакие функции не пересчитывают его после создания.**

---

## 4. Чего нельзя делать из браузера

**Создавать брони.** Политика вставки в `bookings` удалена намеренно
(миграция `20260328000009_bookings_insert_lockdown`). Заявку создаёт только
edge-функция.

**Вызывать `supabase.auth.admin.*`.** Admin-API требует `service_role`-ключ.
Положить его в клиент — значит отдать полный доступ к базе любому, кто откроет
исходники страницы.

**Обходить существующие серверные функции.** Прямой `update` статуса брони
формально пройдёт, но пропустит проверку прав владельца, повторную проверку
занятости дат, создание платёжного намерения и оба письма сторонам.

### Готовые edge-функции — переиспользовать, не переписывать

```
request-rental      { item_id, start_date, end_date, message? } -> { booking_id }
                    Сама проверяет «не своя вещь», занятость дат, ставит
                    pending_approval, шлёт письма. Цену считает сервер.

respond-to-request  { booking_id, action: 'approve' | 'reject' } -> { ok: true }
                    Проверка владельца, Stripe, запись в payments,
                    авто-отклонение пересечений, письма обеим сторонам.

delete-account      {} (нужен Authorization) -> 409, если есть активные брони

Ещё есть: notify-rental, expire-bookings, create-payment-intent,
create-rental-intent, create-pro-checkout, create-business-checkout,
stripe-webhook, verify-phone.
```

Вызов: `supabase.functions.invoke('имя', { body: {...} })`.

---

## 5. Что уже есть в проекте

- **Две системы переводов.** Старая — `src/i18n/` с `t()`, `getLang()`,
  `setLang()`, её используют Home, ItemDetail, ListItem, Login, Register
  (70 строк на французском). Новая — `src/i18n-next.ts` на i18next с
  `src/locales/*.json` (32 ключа), её используют App и Profile. Не подменяй
  одну другой без явной задачи на миграцию — потеряются переводы.
- `src/lib/supabase.ts` — единственный клиент Supabase.
- `src/context/AuthContext.tsx` — источник `user` и `accessToken`.
- Хуки данных живут в `src/hooks/`, мутации — в `src/hooks/mutations/`.

---

## 6. Как проверяют твою работу

Каждая порция проходит: `npm run build` (внутри `tsc`), `npx vitest run`,
скан на секреты, запуск против живой базы. Отчёт без этих проверок не
принимается — не из формализма, а потому что за один день сюда попали
невалидный `package.json`, вызов admin-API из браузера и обращения к двум
несуществующим таблицам. Ни одно из этого не видно тому, кто не запускает код.
