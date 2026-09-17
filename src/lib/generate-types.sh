#!/usr/bin/env bash
# src/lib/generate-types.sh
#
# Генерация типов базы: единственный источник правды о схеме на стороне
# клиента. Запускать из корня репозитория:
#
#   npm run generate-types            (ref: окружение → .env → привязка CLI)
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
  # `|| true` обязателен. При `set -euo pipefail` grep без совпадения возвращает
  # 1, и с pipefail этот код становится кодом всей подстановки — скрипт умирал
  # ПРЯМО ЗДЕСЬ, не дойдя ни до подсказки «ref не задан», ни до проверок ниже.
  # Умирал молча: вывода нет, код 1, и со стороны это неотличимо от «всё сошлось,
  # менять нечего». Ровно так 17.09.2026 отсутствие ref было прочитано как
  # отсутствие дрейфа.
  REF="$(grep -E '^SUPABASE_PROJECT_REF=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '[:space:]' || true)"
fi

# Третий источник — привязка самого CLI. `supabase link` кладёт ref в
# supabase/.temp/project-ref, и если проект привязан, спрашивать его у человека
# незачем: он уже назван, причём тем же инструментом, который сейчас и позовут.
#
# ЗАЧЕМ ЭТО ДОБАВЛЕНО. В .env этого репозитория ключа SUPABASE_PROJECT_REF нет
# (он был только в одной из рабочих копий), и `npm run generate-types` обрывался
# на первой же проверке. Ручной шаг, без которого команда не работает, — дефект
# команды, а не забывчивость того, кто её запускает.
if [ -z "$REF" ] && [ -f "$ROOT/supabase/.temp/project-ref" ]; then
  REF="$(tr -d '[:space:]' < "$ROOT/supabase/.temp/project-ref")"
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

# Перекодировка делается НА NODE, а не на python.
#
# Почему сменён интерпретатор: на машине, где этот скрипт и должны запускать,
# настоящего python нет. И `python`, и `python3` там перехватывает заглушка
# Microsoft Store — она печатает одно слово «Python» и выходит с кодом 49.
# То есть скрипт падал на первом же преобразовании, ещё до единой проверки, и
# падал МОЛЧА: сообщение заглушки не похоже на ошибку, а `npm run` показывал
# пустой вывод. 17.09.2026 это и случилось — «файл не изменился» было прочитано
# как «дрейфа нет», хотя файл просто не писали.
#
# node здесь не новая зависимость, а та единственная, без которой проект не
# собирается вовсе. Поведение сохранено дословно: UTF-16LE с BOM, UTF-8 с BOM и
# чистый UTF-8 на входе; на выходе UTF-8 без BOM и только LF.
node - "$TMP_OUT" "$OUT" <<'JS'
const fs = require('node:fs');
const [src, dst] = process.argv.slice(2);
const raw = fs.readFileSync(src);
let text;
if (raw[0] === 0xff && raw[1] === 0xfe) {
  text = raw.toString('utf16le');
} else if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  text = raw.subarray(3).toString('utf8');
} else {
  text = raw.toString('utf8');
}
fs.writeFileSync(dst, text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
JS

# Пустой или обрезанный файл хуже отсутствующего: он собирается, но
# описывает пустую схему, и `tsc` перестаёт ловить расхождения.
if ! grep -q "items:" "$OUT"; then
  echo "В выводе нет таблицы items — генерация не удалась, файл не трогаем" >&2
  git -C "$ROOT" checkout -- "$OUT" 2>/dev/null || rm -f "$OUT"
  exit 1
fi

node - "$OUT" <<'JS'
const fs = require('node:fs');
const raw = fs.readFileSync(process.argv[2]);
if (raw[0] === 0xff && raw[1] === 0xfe) {
  console.error('БОМ UTF-16LE обнаружена: аннулирую сгенерированный файл и прерываю прогон');
  process.exit(1);
}
JS

echo "Готово. Дальше: createClient<Database> в src/lib/supabase.ts и npx tsc --noEmit"
