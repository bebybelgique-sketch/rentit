import { describe, it, expect } from 'vitest';
import { findMissingKeys, collectUsedKeys } from '../../scripts/check-i18n-keys.mjs';

// Проверка словарей в наборе тестов, а не только отдельной командой.
// 13.08 в main въехали #30 и #31 при КРАСНОМ check-i18n-keys: скрипт был
// ручной, ни один прогон его не звал, CI у проекта нет. Итог — навбар
// вошедшего пользователя показывал в проде
// «key 'myItems (fr)' returned an object instead of string.».
// Страж утверждений от того же не страдает ровно потому, что обёрнут в
// claims.test.ts. Здесь тот же приём.
describe('словари', () => {
  it('каждый t() из кода есть строкой во всех трёх языках', () => {
    const problems = findMissingKeys();
    const report = problems
      .map((p) => `${p.key} — нет в: ${p.missing.join(', ')}\n  ${p.reason}\n  ${p.where[0]}`)
      .join('\n\n');
    expect(report).toBe('');
  });

  // Проверка, которая никогда не срабатывает, неотличима от сломанной.
  it('ключей в коде найдено правдоподобное число', () => {
    // Если обход перестанет находить файлы (сменится путь, расширение,
    // отбор по useTranslation), findMissingKeys вернёт пустой массив и
    // тест выше станет зелёным, ничего не проверив.
    expect(collectUsedKeys().size).toBeGreaterThan(100);
  });
});
