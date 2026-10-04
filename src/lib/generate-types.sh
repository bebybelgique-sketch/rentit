#!/usr/bin/env bash
# src/lib/generate-types.sh
#
# Генерация типов базы: единственный источник правды о схеме на стороне
# клиента. Запускать из корня репозитория:
#
#   SUPABASE_DB_URL=<url роли schema_reader> npm run generate-types
#
# Генератор ходит прямо в базу ролью schema_reader (миграция 60): структура
# public ей видна, данные нет. URL с паролем — секрет SCHEMA_READER_DB_URL в
# GitHub, у владельца — в хранилище вне репозитория. Нужен запущенный Docker:
# генератор (postgres-meta) CLI поднимает контейнером.
#
# ПУТЬ ОДИН, И ЭТО НАМЕРЕННО. Сторож .github/workflows/schema-drift.yml
# зовёт этот же скрипт и сверяет результат с файлом в репозитории побайтно.
# До 04.10.2026 здесь был и второй путь — `--project-id` через Management API
# (нужен личный токен). Его текст отличается от текста `--db-url` при той же
# схеме: блок __InternalSupabase, `NonNullable<Json>`, `never` у
# вычисляемых колонок, порядок колонок. Сгенерировал одним путём — сторож,
# идущий другим, видел бы вечный «дрейф». Поэтому версии CLI и prettier
# закреплены ниже: другая версия генератора — другой текст.
#
# ЧТО ИЗМЕНИЛОСЬ ПРОТИВ САМОЙ ПЕРВОЙ ВЕРСИИ. Она требовала ВПИСАТЬ ref в сам
# файл (`PROJECT_ID="<YOUR_SUPABASE_PROJECT_ID>"`), то есть закоммитить
# идентификатор проекта в публичный репозиторий, и писала результат в
# src/types/supabase.generated.ts — файл, которого в проекте нет, при том
# что заглушка называлась src/types/supabase.ts. Запустить её как есть
# было нельзя, и не запускал никто: типы в src/types/index.ts написаны
# руками и разошлись со схемой (image_url, latitude, longitude,
# is_available — таких колонок в items нет).
set -euo pipefail

SUPABASE_CLI="supabase@2.119.0"
PRETTIER="prettier@3.9.9"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/src/types/database.types.ts"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL не задан — нужен URL роли schema_reader" >&2
  echo "(секрет SCHEMA_READER_DB_URL; у владельца — в хранилище вне репозитория)" >&2
  exit 1
fi

OUT_REL="${OUT#$ROOT/}"
echo "Генерация типов по SUPABASE_DB_URL → $OUT_REL"
TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

npx -y "$SUPABASE_CLI" gen types typescript --db-url "$SUPABASE_DB_URL" --schema public > "$TMP_OUT"

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

# CLI с --db-url отдаёт текст неотформатированным (ключи в кавычках, колонки
# одной строкой). Форматирование — закреплённым prettier, по правилам файла в
# репозитории: без точек с запятой.
npx -y "$PRETTIER" --parser typescript --no-semi --end-of-line lf --write "$OUT" > /dev/null

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
