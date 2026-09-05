#!/usr/bin/env bash
# src/lib/generate-types.sh
#
# Генерация типов базы: единственный источник правды о схеме на стороне
# клиента. Запускать из корня репозитория:
#
#   npm run generate-types            (ref берётся из .env)
#   SUPABASE_PROJECT_REF=<ref> npm run generate-types
#
# Нужен вход в Supabase CLI (`npx supabase login`) — ключа из .env для
# этого недостаточно: gen types ходит в Management API, а не в базу.
#
# ЧТО ИЗМЕНИЛОСЬ ПРОТИВ ПРЕЖНЕЙ ВЕРСИИ. Она требовала ВПИСАТЬ ref в сам
# файл (`PROJECT_ID="<YOUR_SUPABASE_PROJECT_ID>"`), то есть закоммитить
# идентификатор проекта в публичный репозиторий, и писала результат в
# src/types/supabase.generated.ts — файл, которого в проекте нет, при том
# что заглушка называлась src/types/supabase.ts. Запустить её как есть
# было нельзя, и не запускал никто: типы в src/types/index.ts написаны
# руками и разошлись со схемой (image_url, latitude, longitude,
# is_available — таких колонок в items нет).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/src/types/database.types.ts"

REF="${SUPABASE_PROJECT_REF:-}"
# Запасной источник — .env, тот же файл, из которого читают прогоны.
if [ -z "$REF" ] && [ -f "$ROOT/.env" ]; then
  REF="$(grep -E '^SUPABASE_PROJECT_REF=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '[:space:]')"
fi

if [ -z "$REF" ]; then
  echo "SUPABASE_PROJECT_REF не задан: ни в окружении, ни в .env" >&2
  echo "Найти его можно в адресе проекта: https://<ref>.supabase.co" >&2
  exit 1
fi

echo "Генерация типов из проекта $REF → ${OUT#"$ROOT"/}"
npx supabase gen types typescript --project-id "$REF" --schema public > "$OUT"

# Пустой или обрезанный файл хуже отсутствующего: он собирается, но
# описывает пустую схему, и `tsc` перестаёт ловить расхождения.
if ! grep -q "items:" "$OUT"; then
  echo "В выводе нет таблицы items — генерация не удалась, файл не трогаем" >&2
  git -C "$ROOT" checkout -- "$OUT" 2>/dev/null || rm -f "$OUT"
  exit 1
fi

echo "Готово. Дальше: createClient<Database> в src/lib/supabase.ts и npx tsc --noEmit"
