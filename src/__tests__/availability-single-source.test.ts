import { describe, it, expect } from 'vitest';
import {
  findOverlapArithmetic,
  findLateMigrationsWithOverlap,
  findStaleExemptions,
  countScannedFiles,
  SOURCE_MIGRATION,
} from '../../scripts/check-availability-single-source.mjs';

// Гейт в наборе тестов, а не отдельной командой. Урок 14.08: проверка,
// которую надо не забыть запустить, однажды не запускается — ручной
// check-i18n-keys был КРАСНЫМ, и два PR слились поверх него.
describe('занятость считается в одном месте', () => {
  it('в коде нет своей арифметики пересечения дат', () => {
    const hits = findOverlapArithmetic();
    const report = hits.length
      ? `Пересечение дат считается мимо базы:\n  ${hits.join('\n  ')}\n\n` +
        'Занятость считает public.unavailable_days; спрашивать её через\n' +
        'supabase/functions/_shared/availability.ts. Если это ДРУГОЕ правило\n' +
        '(жизненный цикл брони, а не занятость вещи) — добавить строку в\n' +
        'EXEMPT_LINES с объяснением.'
      : '';
    expect(report).toBe('');
  });

  // Название нарочно без слова-образца: страж ищет его по всему src/, и
  // заголовок теста, содержащий образец, ловил сам себя.
  it(`ни одна миграция после ${SOURCE_MIGRATION} не завела свой расчёт пересечений`, () => {
    expect(findLateMigrationsWithOverlap()).toEqual([]);
  });

  it('в списке исключений нет строк, которых больше нет в коде', () => {
    expect(findStaleExemptions()).toEqual([]);
  });

  // Проверка, которая ничего не находит, неотличима от сломанной: если
  // обход перестанет видеть файлы, всё выше станет зелёным, не проверив
  // ничего. На 17.08.2026 файлов было 133.
  it('обход вообще видит код', () => {
    expect(countScannedFiles()).toBeGreaterThan(100);
  });
});
