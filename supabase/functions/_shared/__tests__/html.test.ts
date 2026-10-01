import { describe, it, expect } from 'vitest'
import { esc } from '../html'

/**
 * Письма собираются как HTML из того, что написали люди. Без экранирования
 * сообщение к заявке становилось разметкой письма с адреса площадки.
 */
describe('esc: пользовательский текст в HTML письма', () => {
  it('разметка из сообщения к заявке остаётся текстом', () => {
    const attack = '</em></p><p><a href="https://evil.example">Confirmez votre compte</a></p>'
    const out = esc(attack)
    expect(out).not.toContain('<a')
    expect(out).not.toContain('</p>')
    expect(out).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;')
  })

  it('кавычки экранируются — значение не выходит из атрибута', () => {
    expect(esc(`" onmouseover="x' `)).toBe('&quot; onmouseover=&quot;x&#39; ')
  })

  it('амперсанд — первым, без двойного экранирования соседей', () => {
    expect(esc('Perceuse & <scie>')).toBe('Perceuse &amp; &lt;scie&gt;')
  })

  it('пустое и отсутствующее — пустая строка, а не «undefined» в письме', () => {
    expect(esc(undefined)).toBe('')
    expect(esc(null)).toBe('')
  })

  it('обычный текст не меняется', () => {
    expect(esc('Ponceuse Bosch — 2 jours')).toBe('Ponceuse Bosch — 2 jours')
  })
})
