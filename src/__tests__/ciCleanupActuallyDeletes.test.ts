import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = readFileSync(join(process.cwd(), '.github', 'workflows', 'gates.yml'), 'utf8');

// Строки, которыми зовут скрипт уборки, где бы в workflow они ни стояли.
const cleanupCalls = workflow
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.includes('cleanup-e2e-items.mjs'));

describe('уборка в CI должна УДАЛЯТЬ, а не показывать', () => {
  // ЧТО СЛУЧИЛОСЬ. Шаг «Убрать остатки прогона» звал скрипт БЕЗ `--apply`,
  // то есть в режиме показа: печатал «Это список, а не удаление» и выходил
  // с нулём. Выглядел отработавшим, не удалял ничего — и так с самого
  // своего появления.
  //
  // Цена замерена 19.09.2026: единственным объявлением на живой витрине
  // оказалась вещь «E2E безкоординат», оставленная оборвавшимся прогоном.
  // Весь публичный шоурум продукта — мусор оснастки.
  it('шаг вообще существует', () => {
    expect(cleanupCalls.length).toBeGreaterThan(0);
  });

  it('каждый вызов идёт с --apply', () => {
    for (const call of cleanupCalls) {
      expect(call, `вызов без --apply: ${call}`).toContain('--apply');
    }
  });

  // `|| true` превращает отказ уборки в тишину — ровно та ошибка, о которой
  // предупреждает шапка самого скрипта. Шаг обязан падать: мусор на витрине
  // это такой же отказ продукта, как красный тест, только молчаливый.
  it('отказ уборки не глушится', () => {
    for (const call of cleanupCalls) {
      expect(call, `отказ проглочен: ${call}`).not.toContain('|| true');
    }
  });

  it('шаг отрабатывает и после падения тестов', () => {
    const at = workflow.indexOf('Убрать остатки прогона');
    expect(at, 'шаг не найден по имени').toBeGreaterThan(-1);
    // `if: always()` — единственное условие, которое срабатывает и при
    // падении, и при отмене прогона.
    expect(workflow.slice(at, at + 200)).toContain('if: always()');
  });
});
