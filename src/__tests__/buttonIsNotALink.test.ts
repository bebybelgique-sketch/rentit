import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

// Комментарии ГАСЯТСЯ, а не вырезаются: длина сохраняется, смещения не едут.
// Разбирать CSS наивно нельзя — в комментариях этого файла встречаются и
// «{», и «}» (в том числе поясняющее «a:hover { text-decoration: underline }»
// прямо внутри правила .btn), и поиск закрывающей скобки обрывал тело
// правила на середине. Первая версия этого теста на том и упала.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// Тело правила по точному селектору (первое вхождение).
const ruleBody = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  if (at < 0) throw new Error(`правило ${selector} не найдено в index.css`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

describe('кнопка не должна вести себя как ссылка', () => {
  // Глобальное правило, из-за которого всё и происходит. Оно НУЖНО — ссылка
  // в тексте обязана подчёркиваться при наведении. Проверяется здесь, чтобы
  // смысл теста ниже был виден целиком: пока это правило живо, каждый класс,
  // которым ссылку оформляют кнопкой, обязан гасить подчёркивание сам.
  it('ссылки в тексте по-прежнему подчёркиваются при наведении', () => {
    expect(ruleBody('a:hover')).toContain('text-decoration: underline');
  });

  // В продукте двадцать мест, где <Link> несёт класс .btn. Без этого правила
  // подпись кнопки подчёркивалась при наведении, а на телефоне состояние
  // наведения ЗАЛИПАЕТ после касания — подчёркивание оставалось висеть.
  it('.btn гасит подчёркивание и в покое, и при наведении', () => {
    expect(ruleBody('.btn')).toContain('text-decoration: none');
    expect(ruleBody('.btn:hover')).toContain('text-decoration: none');
  });

  // Решение в продукте было принято раньше — для кнопок лендинга; у .btn его
  // просто забыли. Проверка держит класс закрытым ЦЕЛИКОМ: если .lp-btn
  // однажды потеряет правило, тест скажет об этом здесь, а не глаза на снимке.
  it('.lp-btn держит то же правило — класс закрыт целиком', () => {
    expect(ruleBody('.lp-btn')).toContain('text-decoration: none');
    expect(ruleBody('.lp-btn:hover')).toContain('text-decoration: none');
  });
});
