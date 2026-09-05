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

OUT_REL="${OUT#$ROOT/}"
echo "Генерация типов из проекта $REF → $OUT_REL"
TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

npx supabase gen types typescript --project-id "$REF" --schema public > "$TMP_OUT"

python - "$TMP_OUT" "$OUT" <<'PY'
import pathlib, sys
src = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])
raw = src.read_bytes()
if raw.startswith(b'\xff\xfe'):
    text = raw.decode('utf-16le')
else:
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('utf-8', errors='strict')
text = text.replace('\r\n', '\n').replace('\r', '\n')
with open(dst, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(text)
PY

# Пустой или обрезанный файл хуже отсутствующего: он собирается, но
# описывает пустую схему, и `tsc` перестаёт ловить расхождения.
if ! grep -q "items:" "$OUT"; then
  echo "В выводе нет таблицы items — генерация не удалась, файл не трогаем" >&2
  git -C "$ROOT" checkout -- "$OUT" 2>/dev/null || rm -f "$OUT"
  exit 1
fi

python - "$OUT" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
raw = p.read_bytes()
if raw.startswith(b'\xff\xfe'):
    raise SystemExit('БОМ UTF-16LE обнаружена: аннулирую сгенерированный файл и прерываю прогон')
PY

echo "Готово. Дальше: createClient<Database> в src/lib/supabase.ts и npx tsc --noEmit"
