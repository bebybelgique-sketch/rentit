import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import i18next from 'i18next'
import fr from '../locales/fr.json'
import nl from '../locales/nl.json'
import en from '../locales/en.json'

/**
 * Регион пилота — ОДНА настройка: ключи region.* в трёх словарях (имя, «в …»,
 * «из …»). Тексты ссылаются на них вложением $t(region.in) и т. п.
 *
 * ЗАЧЕМ. До 04.10 «Brabant wallon» был вписан в шесть текстов каждого языка и
 * в четыре строки index.html. Пилот шире — Brabant wallon и Namurois, — и
 * лендинг врал бы регионом каждому, кто пришёл из Намюра: тот же принцип
 * «текст = реальность», что с почтой и с «prêt». Сменить регион теперь —
 * три ключа на язык плюс index.html, и этот тест не даст забыть ни то, ни
 * другое.
 */
type Dict = Record<string, unknown>

const REGION_WORD = /Brabant|Namur|regio Namen|Waals-|Wallon/

const strings = (o: Dict, path = ''): Array<[string, string]> =>
  Object.entries(o).flatMap(([k, v]) => {
    const q = path ? `${path}.${k}` : k
    return typeof v === 'object' && v !== null ? strings(v as Dict, q) : [[q, String(v)] as [string, string]]
  })

describe('регион пилота — одна настройка', () => {
  it.each([['fr', fr], ['nl', nl], ['en', en]] as const)('%s: регион назван только в region.*', (_, dict) => {
    const offenders = strings(dict as Dict).filter(([k, v]) => !k.startsWith('region.') && REGION_WORD.test(v))
    expect(offenders).toEqual([])
  })

  it.each([['fr', fr], ['nl', nl], ['en', en]] as const)('%s: вложенные ссылки раскрываются', async (lng, dict) => {
    const i18n = i18next.createInstance()
    await i18n.init({ lng, resources: { [lng]: { translation: dict } }, interpolation: { escapeValue: false } })
    const region = (dict as { region: { name: string } }).region
    expect(i18n.t('landing.eyebrow')).toContain(region.name)
    for (const key of ['landing.eyebrow', 'landing.finalTitle', 'landing.renterBodyLive', 'shops.lede', 'shops.stateBody']) {
      expect(i18n.t(key), key).not.toMatch(/\$t\(|region\./)
    }
  })

  it('index.html называет регион словами fr.region.in — и только ими', () => {
    const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8')
    const visible = [
      ...html.matchAll(/<title>([^<]*)<\/title>/g),
      ...html.matchAll(/content="([^"]*)"/g),
    ].map((m) => m[1])
    const mentioning = visible.filter((v) => REGION_WORD.test(v))
    expect(mentioning.length).toBeGreaterThan(0)
    for (const v of mentioning) expect(v).toContain(fr.region.in)
  })
})
