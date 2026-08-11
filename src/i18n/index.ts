import { fr } from './fr'
import { en } from './en'
import { nl } from './nl'

export type Lang = 'en' | 'fr' | 'nl'

export const translations = { fr, en, nl }

export function getLang(): Lang {
  const saved = localStorage.getItem('rentit_lang') as Lang | null
  return saved && saved in translations ? saved : 'fr'
}

export function setLang(lang: Lang) {
  localStorage.setItem('rentit_lang', lang)
  window.location.reload()
}

export function t(key: string): string {
  const dict = translations[getLang()] ?? translations.fr
  const parts = key.split('.')
  let val: any = dict
  for (const p of parts) val = val?.[p]
  if (typeof val === 'string') return val
  // fallback to FR if key missing in the chosen language
  let frVal: any = translations.fr
  for (const p of parts) frVal = frVal?.[p]
  return typeof frVal === 'string' ? frVal : key
}
