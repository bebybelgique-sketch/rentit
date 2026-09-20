import { describe, it, expect } from 'vitest';
import { answerDeadline, isUrgent, ANSWER_WINDOW_HOURS } from '../requestDeadline';

/**
 * Срок ответа назначает планировщик, а не интерфейс:
 * expire-bookings переводит бронь в `expired`, когда
 * `status = 'pending_approval'` и `created_at < now() - 24 часа`.
 *
 * Проверки ниже стерегут то, что число здесь обязано совпадать с тем,
 * что продукт действительно исполняет, и что подпись не врёт ни в одну
 * сторону.
 */
const at = (iso: string) => new Date(iso);
const created = '2026-09-20T10:00:00.000Z';

describe('срок ответа на заявку', () => {
  it('совпадает с окном планировщика', () => {
    expect(ANSWER_WINDOW_HOURS).toBe(24);
  });

  it('сразу после заявки — почти целые сутки', () => {
    const d = answerDeadline(created, at('2026-09-20T10:00:30.000Z'));
    expect(d).toEqual({ state: 'hours', hours: 23 });
  });

  it('через двадцать часов остаются часы', () => {
    expect(answerDeadline(created, at('2026-09-21T06:00:00.000Z')))
      .toEqual({ state: 'hours', hours: 4 });
  });

  // «0 ч» — худшая из подписей: читается как «уже поздно», хотя время есть.
  it('меньше часа считается минутами, а не нулём часов', () => {
    const d = answerDeadline(created, at('2026-09-21T09:20:00.000Z'));
    expect(d).toEqual({ state: 'minutes', minutes: 40 });
  });

  it('последняя минута всё ещё минута, а не ноль', () => {
    const d = answerDeadline(created, at('2026-09-21T09:59:40.000Z'));
    expect(d).toEqual({ state: 'minutes', minutes: 1 });
  });

  // Планировщик ходит раз в полчаса, поэтому заявка переживает срок и
  // какое-то время ЛЕЖИТ просроченной. Сказать «осталось 0» значило бы
  // соврать в обе стороны: и что время есть, и что отмена уже случилась.
  it('после срока — «просрочено», а не ноль', () => {
    expect(answerDeadline(created, at('2026-09-21T10:00:01.000Z')))
      .toEqual({ state: 'overdue' });
  });

  it('ровно в срок — уже просрочено', () => {
    expect(answerDeadline(created, at('2026-09-21T10:00:00.000Z')))
      .toEqual({ state: 'overdue' });
  });

  // Округление ВНИЗ: показанное время — нижняя граница. Владелец,
  // успевший к нему, успевает наверняка. Обратное было бы опасно.
  it('округляет вниз, а не к ближайшему', () => {
    // Осталось 4 ч 59 мин — показываем 4, не 5.
    const d = answerDeadline(created, at('2026-09-21T05:01:00.000Z'));
    expect(d).toEqual({ state: 'hours', hours: 4 });
  });

  // Без даты создания отсчёт не от чего вести. «Осталось 24 ч» было бы
  // выдумкой: срок идёт не от сейчас, а от момента, которого мы не знаем.
  it('без даты создания не выдумывает запас', () => {
    expect(answerDeadline(null, at(created))).toEqual({ state: 'overdue' });
    expect(answerDeadline('не дата', at(created))).toEqual({ state: 'overdue' });
  });
});

describe('срочность отличается видом, а не только числом', () => {
  it('просроченное и минуты — срочно', () => {
    expect(isUrgent({ state: 'overdue' })).toBe(true);
    expect(isUrgent({ state: 'minutes', minutes: 45 })).toBe(true);
  });

  it('меньше трёх часов — срочно', () => {
    expect(isUrgent({ state: 'hours', hours: 2 })).toBe(true);
  });

  it('три часа и больше — ещё нет', () => {
    expect(isUrgent({ state: 'hours', hours: 3 })).toBe(false);
    expect(isUrgent({ state: 'hours', hours: 20 })).toBe(false);
  });
});
