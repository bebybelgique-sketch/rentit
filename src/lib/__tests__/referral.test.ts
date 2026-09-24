import { describe, it, expect, beforeEach } from 'vitest'
import { captureReferral, forgetReferralForTests, normalizeReferral, pendingReferral, withReferral } from '../referral'

// Инварианты приглашения на стороне браузера:
//   • код, пришедший в адресе ЛЮБОЙ страницы, доживает до регистрации;
//   • из адреса он уходит — иначе пришедший по чужой ссылке делился бы
//     дальше чужим кодом;
//   • не-код (опечатка, мусор) не запоминается, но из адреса тоже уходит.

const at = (path: string) => window.history.replaceState(null, '', path)

describe('referral', () => {
  beforeEach(() => {
    forgetReferralForTests()
    at('/')
  })

  it('код — восемь шестнадцатеричных знаков, заглавными', () => {
    expect(normalizeReferral(' ab12cd34 ')).toBe('AB12CD34')
    expect(normalizeReferral('AB12CD3')).toBeNull()
    expect(normalizeReferral('AB12CD34X')).toBeNull()
    expect(normalizeReferral('ZZZZZZZZ')).toBeNull()
    expect(normalizeReferral(null)).toBeNull()
  })

  it('код из адреса объявления запоминается и уходит из адреса, остальное остаётся', () => {
    at('/item/42?ref=ab12cd34&lang=nl#photos')
    captureReferral()
    expect(pendingReferral()).toBe('AB12CD34')
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/item/42?lang=nl#photos')
  })

  it('не-код не запоминается, но из адреса уходит', () => {
    at('/?ref=%3Cscript%3E')
    captureReferral()
    expect(pendingReferral()).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('без ?ref= адрес не трогается', () => {
    at('/item/42?lang=nl')
    captureReferral()
    expect(pendingReferral()).toBeNull()
    expect(window.location.search).toBe('?lang=nl')
  })

  it('ссылка со своим кодом заменяет чужой, без кода — чужой снимает', () => {
    expect(withReferral('https://x.test/item/1?ref=11111111&lang=fr', 'ab12cd34'))
      .toBe('https://x.test/item/1?lang=fr&ref=AB12CD34')
    expect(withReferral('https://x.test/item/1?ref=11111111', undefined)).toBe('https://x.test/item/1')
    expect(withReferral('https://x.test/', 'nope')).toBe('https://x.test/')
  })
})
