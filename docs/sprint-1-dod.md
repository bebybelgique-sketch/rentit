# Sprint 1 — Definition of Done

Что в коде, что осталось сделать руками и чем это проверяется. Файл живёт
в репозитории, потому что половина пунктов ниже — не код, а развёртывание:
проверка, которую никто не может повторить, ничего не доказывает.

Состояние на 05.09.2026.

---

## 1. Развёртывание — блокер, из репозитория не делается

```bash
supabase db push                                   # 20260905000025_admin_audit_log
supabase functions deploy admin-action             # новая
supabase functions deploy respond-to-request       # select/null-guard/коды
supabase functions deploy transition-booking       # коды
npm run test:edge                                  # ПОСЛЕ деплоя, иначе проверит вчерашнее
```

`config.toml` в проекте нет: `verify_jwt` при развёртывании по умолчанию
включён, а `getUserFromAuthHeader` в любом случае валидирует токен
служебным клиентом и отвечает `401 unauthorized`.

Для раздела `admin-action` в прогоне нужны переменные из `.env.example`:
`TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` (учётка, которой роль `admin`
выставлена один раз руками в SQL) и, необязательно,
`SUPABASE_SERVICE_ROLE_KEY` — только чтобы прочитать журнал. Без них
проверки не «зеленеют», а печатаются пометкой `пропуск` и считаются
отдельным числом в итоге.

---

## 2. Безопасность и админка

| Проверка | Чем закрыта |
|---|---|
| В `Admin.tsx` нет `supabase.from(...).update` | `grep`; в файле остались только `select` |
| Без JWT → 401 `unauthorized` | `edge-functions.mjs`, раздел admin-action |
| Не-админ → 403 `forbidden` | там же |
| Снятие прав с себя → 400 `cannot_demote_self` | там же + `actions.test.ts` |
| Неизвестное действие / роль вне списка → 400 `bad_request` | там же + `actions.test.ts` |
| Несуществующая цель → 404 `target_not_found` | там же |
| Успешное действие → строка в `admin_audit_log` | там же (нужен service key) |
| Чтение счётчиков в журнал НЕ пишется | там же |
| Обычный пользователь не читает `admin_audit_log` | там же, под его JWT |
| Прямой `update` роли из браузера не проходит | там же — сторож против расширения грантов |

---

## 3. Брони

- Владелец проходит `pending_approval → confirmed → active → completed`
  не покидая `/my-rentals` — один компонент `BookingOwnerActions`.
- В `/my-items` те же кнопки того же компонента; собственных вызовов
  edge-функций на странице не осталось.
- Ссылка «Ouvrir la conversation» из `/my-items` ведёт на
  `/my-rentals?booking=<id>`: страница прокручивается к карточке и
  подсвечивает её.
- Арендатор owner-кнопок не видит: их показывает только карточка в
  списке владельца.
- Отказ показывается переводом, а не `non-2xx status code`:
  `edgeInvoke` → код → `serverErrorKey` → словарь (тест на все три языка).

---

## 4. Качество — прогоняется локально

```bash
npx tsc --noEmit
npx vitest run
node scripts/check-i18n-keys.mjs
node scripts/check-hardcoded-text.mjs
node scripts/check-claims.mjs
node scripts/check-availability-single-source.mjs
npm run build
```

---

## 5. Сознательно НЕ в Sprint 1

- `useOwnerItems` и единый префикс query keys (`MyItems` пока на `useState`).
- `database.types.ts` вместо ручных интерфейсов.
- Локализация `/admin` целиком: сейчас переведены только отказы и
  подтверждения, подписи вкладок остаются английскими.
- Просмотр `admin_audit_log` из интерфейса: журнал читается SQL-консолью
  под служебной ролью.

---

## 6. Сделано сверх плана — и почему

**Вкладка Stats считала личные цифры.** Счётчики брались запросами из
браузера под правами администратора, а RLS отдаёт ему только его строки:
«Bookings» показывал число его собственных сделок, «Revenue» — почти
всегда ноль. Теперь считает сервер (`get_stats`), а плитка выручки убрана
совсем: платформа не берёт комиссию и не держит денег, и обещать доход от
несуществующей модели нельзя даже в служебном экране.
