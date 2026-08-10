#!/bin/bash
# generate-types.sh
# Скрипт для генерации типов TypeScript из схемы базы данных Supabase.
# ПЕРЕД ЗАПУСКОМ: замените <YOUR_SUPABASE_PROJECT_ID> на реальный ID вашего проекта.
# Пример: SUPABASE_PROJECT_ID=dexnhfdjlvbwtrgyqimvuofkktwpzbbs npm run generate-types

PROJECT_ID="<YOUR_SUPABASE_PROJECT_ID>"

if [ "$PROJECT_ID" = "<YOUR_SUPABASE_PROJECT_ID>" ]; then
  echo "Ошибка: PROJECT_ID не задан. Отредактируйте этот файл или используйте переменную окружения."
  exit 1
fi

echo "Генерация типов из проекта: $PROJECT_ID"
npx supabase gen types typescript --project-id $PROJECT_ID --schema public > ../types/supabase.generated.ts

if [ $? -eq 0 ]; then
  echo "Типы успешно сгенерированы в ../types/supabase.generated.ts"
  echo "Теперь обновите ../types/index.ts, чтобы он использовал новые типы."
else
  echo "Ошибка при генерации типов."
fi