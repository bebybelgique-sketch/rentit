import { describe, it, expect } from 'vitest';
import { findHardcodedText, findNewHardcodedText, readAllowlist } from '../../scripts/check-hardcoded-text.mjs';

// Храповик в наборе тестов, а не отдельной командой. Урок 14.08: проверка,
// которую надо не забыть запустить, однажды не запускается — ручной
// check-i18n-keys был КРАСНЫМ, и два PR слились поверх него.
describe('текст мимо словарей', () => {
  it('нового захардкоженного текста не появилось', () => {
    const fresh = findNewHardcodedText();
    const report = fresh.length
      ? `Новый текст в разметке мимо словарей:\n  ${fresh.join('\n  ')}\n\n` +
        'Завернуть в t(), либо — если перевод не нужен (логотип, атрибуция, ' +
        'служебная страница) — обновить список:\n' +
        '  node scripts/check-hardcoded-text.mjs --freeze'
      : '';
    expect(report).toBe('');
  });

  // Проверка, которая ничего не находит, неотличима от сломанной: если
  // обход перестанет видеть файлы, findNewHardcodedText вернёт пусто и
  // тест выше станет зелёным, не проверив ничего.
  it('обход вообще находит разметку', () => {
    expect(findHardcodedText().length).toBeGreaterThan(0);
  });

  // Список должен оставаться описанием ФАКТА, а не свалкой: строка,
  // которую уже завернули в t(), обязана из него уйти.
  it('в списке нет строк, которых больше нет в коде', () => {
    const actual = new Set(findHardcodedText());
    const stale = [...readAllowlist()].filter((a) => !actual.has(a));
    expect(stale).toEqual([]);
  });
});
