#!/usr/bin/env bash
# pre-commit.sh
# Хук для проверки перед коммитом

echo "Запуск проверок перед коммитом..."

# Запуск TypeScript проверки
echo "Проверка типов..."
npm run type-check || exit 1

# Запуск юнит-тестов
echo "Запуск юнит-тестов..."
npm run test:unit -- --run || exit 1

echo "Все проверки пройдены!"