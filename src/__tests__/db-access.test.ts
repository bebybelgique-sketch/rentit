import { describe, it, expect } from 'vitest';
import {
  countDbAccess,
  countInSource,
  countScannedFiles,
  findExcess,
  findStaleAllowlist,
} from '../../scripts/check-db-access.mjs';

// Храповик в наборе тестов, а не отдельной командой. Урок 14.08: проверка,
// которую надо не забыть запустить, однажды не запускается — ручной
// check-i18n-keys был КРАСНЫМ, и два PR слились поверх него.
describe('прямой доступ к базе из страниц и компонентов', () => {
  it('нового прямого доступа не появилось', () => {
    const excess = findExcess();
    const report = excess.length
      ? `Прямых обращений к базе больше, чем разрешено списком:\n  ${excess.join('\n  ')}\n\n` +
        'Вынести запрос в src/hooks/** (страницы и компоненты ходят в базу\n' +
        'через хуки) и УМЕНЬШИТЬ число в scripts/db-access-allowlist.json.\n' +
        'Заморозить новое место можно только осознанно:\n' +
        '  node scripts/check-db-access.mjs --freeze'
      : '';
    expect(report).toBe('');
  });

  // Храповик крутится только вниз: число в списке обязано описывать код, а не
  // намерение. Иначе список превращается в запас, из которого потом «законно»
  // достают места под новые запросы.
  it('список не отстал от кода', () => {
    expect(findStaleAllowlist()).toEqual([]);
  });

  // Проверка, которая ничего не находит, неотличима от сломанной: если обход
  // перестанет видеть файлы, два теста выше станут зелёными, не проверив
  // ничего.
  it('обход вообще видит код и находит известные места', () => {
    expect(countScannedFiles()).toBeGreaterThan(40);
    expect(countDbAccess().get('src/pages/ItemDetail.tsx')).toBeGreaterThan(0);
  });

  it('хуки не ограничены: запросов из src/hooks в списке нет', () => {
    expect([...countDbAccess().keys()].some((f) => f.startsWith('src/hooks/'))).toBe(false);
  });

  // Файла вне списка этот тест не требует отдельно: для него разрешённое
  // число равно нулю, и первое же обращение попадает в findExcess.
});

describe('счётчик обращений', () => {
  it('видит цепочку, разорванную переводом строки', () => {
    // Подсчёт глазами (grep -n по строке) давал в ItemDetail 4 обращения
    // вместо 7 и пропускал ItemBlackouts.load() и Register.tsx ЦЕЛИКОМ:
    // там `await supabase` и `.from('…')` стоят на разных строках. Храповик,
    // который не видит переноса строки, дыряв ровно там, где код пишут
    // аккуратно.
    expect(countInSource("const { data } = await supabase\n  .from('items')\n  .select('*')\n")).toBe(1);
  });

  it('считает обращения, а не файлы', () => {
    expect(
      countInSource(
        "await supabase.from('items').select('*');\nawait supabase.rpc('item_history', { p_item_id: id });\n",
      ),
    ).toBe(2);
  });

  it('проза о прошлом обращением не считается', () => {
    expect(countInSource("// Прямой `supabase.from('users').update()` отсюда убран\nexport const a = 1\n")).toBe(0);
    expect(countInSource("/* supabase.from('items').select('*') */\nexport const a = 1\n")).toBe(0);
    expect(countInSource(" * supabase.rpc('browse_items')\n")).toBe(0);
  });

  it('сессия, файлы и edge-функции — не обращение к таблицам', () => {
    expect(
      countInSource(
        "await supabase.auth.getUser();\n" +
        "await supabase.storage.from('avatars').upload(path, file);\n" +
        "await supabase.functions.invoke('respond-to-request', { body: {} });\n",
      ),
    ).toBe(0);
  });
});
