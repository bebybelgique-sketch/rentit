import { describe, it, expect } from 'vitest';
import {
  RETIRED,
  countInSource,
  countRetired,
  countScannedFiles,
  findExcess,
  findStaleAllowlist,
  stripComments,
} from '../../scripts/check-retired-palette.mjs';

// Храповик в наборе тестов, а не отдельной командой. Урок 14.08: проверка,
// которую надо не забыть запустить, однажды не запускается.
describe('снятая палитра', () => {
  it('снятых цветов не прибавилось', () => {
    const excess = findExcess();
    const report = excess.length
      ? `Снятая палитра вернулась:\n  ${excess.join('\n  ')}\n\n` +
        'Взять цвет из токенов src/index.css и УМЕНЬШИТЬ число в\n' +
        'scripts/retired-palette-allowlist.json.'
      : '';
    expect(report).toBe('');
  });

  // Храповик крутится только вниз: число в списке обязано описывать код.
  it('список не отстал от кода', () => {
    expect(findStaleAllowlist()).toEqual([]);
  });

  // Проверка, которая ничего не находит, неотличима от сломанной.
  it('обход вообще видит код', () => {
    expect(countScannedFiles()).toBeGreaterThan(40);
  });

  // 19.09 лайм ушёл из живого кода целиком. Если он вернётся хоть куда-то,
  // этот тест станет красным раньше, чем кто-нибудь откроет прод с телефона.
  it('лайма не осталось нигде в живом коде', () => {
    const lime = [...countRetired().values()].some(o => '#ADFF2F' in o);
    expect(lime).toBe(false);
  });
});

describe('счётчик снятых цветов', () => {
  it('видит цвет в инлайн-стиле и в шаблонной строке', () => {
    expect(countInSource("<span style={{ color: '#ADFF2F' }}>It</span>")).toEqual({ '#ADFF2F': 1 });
    expect(countInSource('html: `<div style="background:#080808">€</div>`')).toEqual({ '#080808': 1 });
  });

  it('регистр записи значения не имеет', () => {
    expect(countInSource("color: '#adff2f'")).toEqual({ '#ADFF2F': 1 });
  });

  // Комментарий — это ЗАПИСЬ о снятии цвета. Запрещать его значит стирать
  // причину, по которой цвет ушёл.
  it('упоминание в комментарии нарушением не считается', () => {
    expect(countInSource('// Метка была лаймовой (#ADFF2F на #080808)')).toEqual({});
    expect(countInSource('/* лайм #ADFF2F снят 12.08 */')).toEqual({});
    expect(stripComments(' * старый чёрный #080808\n').trim()).toBe('');
  });

  it('оба снятых цвета названы вместе с заменой', () => {
    expect(Object.keys(RETIRED)).toEqual(['#ADFF2F', '#080808']);
    expect(RETIRED['#ADFF2F']).toMatch(/action|signal/);
  });
});
