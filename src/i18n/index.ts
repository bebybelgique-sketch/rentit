import { fr } from './fr'
import { en } from './en'

export type Lang = 'en' | 'fr'

export const translations = { fr, en }

export function getLang(): Lang {
  return (localStorage.getItem('rentit_lang') as Lang) || 'fr'
}

export function setLang(lang: Lang) {
  localStorage.setItem('rentit_lang', lang)
  window.location.reload()
}

export function t(key: string): string {
  const lang = getLang()
  const dict = lang === 'en' ? translations.en : translations.fr
  const parts = key.split('.')
  let val: any = dict
  for (const p of parts) val = val?.[p]
  if (typeof val === 'string') return val
  // fallback to FR if EN key missing
  let frVal: any = translations.fr
  for (const p of parts) frVal = frVal?.[p]
  return typeof frVal === 'string' ? frVal : key
}
