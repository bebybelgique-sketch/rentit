import { describe, it, expect } from 'vitest'
import {
  LIMITS, cleanPath, fingerprintOf, isNoise, normalizeMessage, parseReport, pathPattern, topFrame,
  type ClientErrorReport,
} from '../clientErrors'

/**
 * Приём отчётов о поломках: что принимается, что отбрасывается, как
 * группируется. Приём открыт для анонима, поэтому проверяется в первую
 * очередь то, что НЕ должно пройти.
 */

const base = {
  kind: 'render',
  message: "TypeError: Cannot read properties of undefined (reading 'title')",
  stack: 'TypeError: …\n    at Kt (https://rentit-plum.vercel.app/assets/ItemDetail-B7v_NMCH.js:1:2345)',
  path: '/item/3f2a1b4c-1111-4222-8333-944455556666',
  release: 'a1b2c3d',
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0',
  lang: 'nl',
}

describe('что принимается', () => {
  it('обычный отчёт', () => {
    expect(parseReport(base)).toEqual({
      kind: 'render',
      message: base.message,
      stack: base.stack,
      path: base.path,
      release: 'a1b2c3d',
      userAgent: base.userAgent,
      lang: 'nl',
    })
  })

  it('не отчёт — отказ', () => {
    for (const bad of [null, 'строка', [], {}, { ...base, kind: 'hack' }, { ...base, message: '   ' }, { ...base, path: 'https://evil.example/' }, { ...base, path: '//evil' }]) {
      expect(parseReport(bad)).toBeNull()
    }
  })

  it('строка запроса и хеш отрезаются: в ссылках из писем бывают токены', () => {
    expect(parseReport({ ...base, path: '/reset-password?code=SECRET#access_token=SECRET' })?.path).toBe('/reset-password')
    expect(cleanPath('/my-rentals?booking=1')).toBe('/my-rentals')
  })

  it('телефон и почта в тексте и в стеке маскируются', () => {
    const r = parseReport({ ...base, message: 'Erreur pour jean@example.be, tel 0475 12 34 56', stack: 'at x (0475123456)' })!
    expect(r.message).not.toMatch(/jean@example\.be|0475/)
    expect(r.message).toContain('•••')
    expect(r.stack).not.toContain('0475123456')
  })

  // Первая версия маскировала след стека широкой маской почты из
  // уведомлений — и Firefox-строка «Kt@https://…/ItemDetail.js:1:2» для неё
  // «адрес». След исчезал целиком, отпечаток расходился с Chrome.
  it('след стека Firefox — не адрес почты', () => {
    const stack = 'Kt@https://rentit-plum.vercel.app/assets/ItemDetail-B7v_NMCH.js:1:2345\nrender@http://localhost:4173/src/App.tsx:10:5'
    expect(parseReport({ ...base, stack })!.stack).toBe(stack)
    expect(parseReport({ ...base, stack: 'at x (a.js:1:1) — écrire à marie.dupont+rentit@example.be' })!.stack)
      .toBe('at x (a.js:1:1) — écrire à •••')
  })

  it('длина каждого поля — не больше предела таблицы', () => {
    const r = parseReport({
      ...base,
      message: 'x'.repeat(5000), stack: 'y'.repeat(50000), path: '/' + 'p'.repeat(1000), userAgent: 'u'.repeat(5000),
    })!
    expect(Array.from(r.message).length).toBeLessThanOrEqual(LIMITS.message)
    expect(Array.from(r.stack!).length).toBeLessThanOrEqual(LIMITS.stack)
    expect(Array.from(r.path).length).toBeLessThanOrEqual(LIMITS.path)
    expect(Array.from(r.userAgent!).length).toBeLessThanOrEqual(LIMITS.userAgent)
  })

  it('мегабайт мусора разбирается быстро: приём открыт всем', () => {
    const t0 = performance.now()
    parseReport({ ...base, message: 'y'.repeat(1_000_000), stack: 'z'.repeat(1_000_000) })
    expect(performance.now() - t0).toBeLessThan(200)
  })

  it('номер на границе обрезки всё равно замаскирован', () => {
    const r = parseReport({ ...base, message: 'x'.repeat(LIMITS.message - 6) + ' 0475 12 34 56 et la suite' })!
    expect(r.message).not.toMatch(/0475|04/)
  })

  it('неверная версия и неизвестный язык — пусто, а не отказ', () => {
    const r = parseReport({ ...base, release: "a'; drop table", lang: 'de' })!
    expect(r.release).toBeNull()
    expect(r.lang).toBeNull()
  })
})

describe('шум отбрасывается', () => {
  it('чужой скрипт, расширения браузера, ResizeObserver', () => {
    expect(isNoise('Script error.', null)).toBe(true)
    expect(isNoise('Script error.', 'at x (https://rentit/app.js:1:1)')).toBe(false)
    expect(isNoise('boom', 'at x (chrome-extension://abcdef/content.js:1:1)')).toBe(true)
    expect(isNoise('ResizeObserver loop completed with undelivered notifications.', null)).toBe(true)
    expect(parseReport({ ...base, message: 'Script error.', stack: '' })).toBeNull()
  })
})

describe('группировка', () => {
  it('первая строка стека — одинаково во всех браузерах', () => {
    expect(topFrame('TypeError: x\n    at Kt (https://rentit-plum.vercel.app/assets/ItemDetail-B7v_NMCH.js:1:2345)')).toBe('Kt@ItemDetail')
    expect(topFrame('Kt@https://rentit-plum.vercel.app/assets/ItemDetail-B7v_NMCH.js:1:2345')).toBe('Kt@ItemDetail')
    expect(topFrame('    at Object.Kt (https://rentit-plum.vercel.app/assets/ItemDetail-Zz9_QQ12.js:3:10)')).toBe('Kt@ItemDetail')
    expect(topFrame('    at https://rentit-plum.vercel.app/assets/index-u_axv-YY.js:40:120')).toBe('@index')
    expect(topFrame('без места')).toBe('')
    expect(topFrame(null)).toBe('')
  })

  it('числа, идентификаторы и адреса не делят одну поломку на много', () => {
    expect(normalizeMessage('Item 3f2a1b4c-1111-4222-8333-944455556666 not found (42)'))
      .toBe(normalizeMessage('Item 00000000-0000-4000-8000-000000000000 not found (7)'))
    expect(pathPattern('/item/3f2a1b4c-1111-4222-8333-944455556666')).toBe('/item/:id')
  })

  it('одна поломка у двух людей и в двух сборках — один отпечаток', async () => {
    const a = parseReport(base)!
    const b = parseReport({
      ...base,
      path: '/item/00000000-0000-4000-8000-000000000000',
      stack: 'Kt@https://rentit-plum.vercel.app/assets/ItemDetail-QQ99_new.js:1:99',
      release: 'ffffff0',
      userAgent: 'Firefox',
    })!
    expect(await fingerprintOf(a)).toBe(await fingerprintOf(b))
    expect(await fingerprintOf(a)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('разные поломки — разные отпечатки', async () => {
    const a = parseReport(base)!
    const other: ClientErrorReport = { ...a, message: "TypeError: Cannot read properties of null (reading 'id')" }
    const otherPage: ClientErrorReport = { ...a, path: '/my-rentals' }
    const otherKind: ClientErrorReport = { ...a, kind: 'promise' }
    const prints = await Promise.all([a, other, otherPage, otherKind].map(fingerprintOf))
    expect(new Set(prints).size).toBe(4)
  })
})
