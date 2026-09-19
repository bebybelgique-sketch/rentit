import { describe, it, expect } from 'vitest';
import {
  countLocales,
  emojiIn,
  findAll,
  findInLocales,
  findInSource,
  readAllowlist,
} from '../../scripts/check-emoji-in-ui.mjs';

// Храповик в наборе тестов, а не отдельной командой. Урок 14.08: проверка,
// которую надо не забыть запустить, однажды не запускается.
describe('цветные эмодзи в интерфейсе', () => {
  it('их нет ни в словарях, ни в разметке', () => {
    const hits = findAll();
    const report = hits.length
      ? `Цветные эмодзи вернулись:\n  ${hits.join('\n  ')}\n\n` +
        'Значок берётся из CategoryIcon (категории) или StateIcon (состояния).'
      : '';
    expect(report).toBe('');
  });

  // Проверка, которая ничего не находит, неотличима от сломанной.
  it('обход видит все три словаря и вообще открывает файлы', () => {
    expect(countLocales()).toBe(3);
    expect(findInLocales()).toEqual([]);
    expect(findInSource()).toEqual([]);
  });

  // Единственное исключение, и оно названо поимённо: текст уезжает в чужое
  // приложение, где эмодзи — норма, а не разнобой языков.
  it('исключение ровно одно — текст, уходящий наружу', () => {
    expect([...readAllowlist()]).toEqual(['share.whatsappText']);
  });
});

describe('что считается эмодзи', () => {
  // Граница проведена по Unicode-свойству Emoji_Presentation — знакам,
  // которые ПО УМОЛЧАНИЮ рисуются цветной картинкой. Диапазонами это не
  // различить: ⚡ (U+26A1) стоит в том же блоке, что ✓ (U+2713) и ✦ (U+2726).
  it('цветные ловятся', () => {
    for (const ch of ['⚡', '🔧', '🌿', '🎉', '📍', '📦', '📸', '🔨']) {
      expect(emojiIn(`текст ${ch} текст`)).toHaveLength(1);
    }
  });

  it('одноцветная типографика — не эмодзи, ей место в тексте', () => {
    for (const ch of ['✓', '✦', '→', '·', '—', '«', '»']) {
      expect(emojiIn(`текст ${ch} текст`)).toEqual([]);
    }
  });

  it('строка без знаков чиста', () => {
    expect(emojiIn('Déposer votre premier outil')).toEqual([]);
  });
});
