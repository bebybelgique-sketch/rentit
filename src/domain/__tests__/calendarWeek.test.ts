import { describe, it, expect } from 'vitest';
import { monthStartOffset, weekdayLabels } from '../availability';

/**
 * Календарь на странице вещи начинал неделю с ВОСКРЕСЕНЬЯ: `Date.getDay()`
 * считает от него, это американское соглашение. В Бельгии неделя начинается
 * с понедельника, и сетка съезжала на день — число вставало не в свою
 * колонку. Ошибка тихая: календарь выглядел исправным, просто показывал
 * неверный день недели.
 *
 * Подписи дней при этом были зашиты как ['Di','Lu',…] — французские для
 * англичанина и голландца.
 */
describe('календарь: неделя с понедельника', () => {
  // 1 сентября 2026 — вторник. При понедельнике-первом перед ним одна
  // пустая клетка; при воскресенье-первом было бы две.
  it('вторник даёт одну пустую клетку, а не две', () => {
    expect(monthStartOffset(2026, 8)).toBe(1);
  });

  // 1 февраля 2026 — воскресенье, самый показательный случай: при старом
  // отсчёте оно стояло ПЕРВЫМ в строке, теперь — последним, шестая клетка.
  it('воскресенье уходит в конец недели, а не в начало', () => {
    expect(monthStartOffset(2026, 1)).toBe(6);
  });

  // 1 июня 2026 — понедельник: пустых клеток нет вовсе.
  it('понедельник не оставляет пустых клеток', () => {
    expect(monthStartOffset(2026, 5)).toBe(0);
  });

  it('смещение всегда в пределах недели', () => {
    for (let m = 0; m < 12; m++) {
      const offset = monthStartOffset(2026, m);
      expect(offset, `месяц ${m}`).toBeGreaterThanOrEqual(0);
      expect(offset, `месяц ${m}`).toBeLessThanOrEqual(6);
    }
  });
});

describe('календарь: подписи дней идут за языком читателя', () => {
  it('их ровно семь', () => {
    expect(weekdayLabels('fr-BE')).toHaveLength(7);
  });

  // Порядок обязан совпадать со смещением выше: иначе число встанет под
  // чужую подпись, и обе половины по отдельности будут выглядеть верными.
  it('первый — понедельник, последний — воскресенье', () => {
    const fr = weekdayLabels('fr-BE');
    expect(fr[0].toLowerCase()).toMatch(/^lun/);
    expect(fr[6].toLowerCase()).toMatch(/^dim/);
  });

  it('язык меняет подписи — они не зашиты по-французски', () => {
    const fr = weekdayLabels('fr-BE');
    const nl = weekdayLabels('nl-BE');
    const en = weekdayLabels('en-GB');

    expect(nl[0].toLowerCase()).toMatch(/^ma/);   // maandag
    expect(en[0].toLowerCase()).toMatch(/^mon/);  // Monday
    expect(nl).not.toEqual(fr);
    expect(en).not.toEqual(fr);
  });

  // Все три языка начинают с понедельника — иначе сетка и подписи
  // разъехались бы именно там, где разница в соглашениях и живёт.
  it('понедельник первый во всех трёх языках продукта', () => {
    for (const locale of ['fr-BE', 'nl-BE', 'en-GB']) {
      const first = weekdayLabels(locale)[0].toLowerCase();
      expect(first, locale).toMatch(/^(lun|ma|mon)/);
    }
  });
});
