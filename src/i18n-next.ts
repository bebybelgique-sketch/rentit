// src/i18n-next.ts
//
// ЕДИНСТВЕННАЯ система переводов. До 12.08 их было две: react-i18next держал
// навбар, MyRentals и Profile, а самописная src/i18n/ — витрину, страницу
// вещи, выкладку, вход и регистрацию. Никто так не решал: вторую принесли
// вторым заходом Qwen (коммит 4d553c2 «довести до собираемого состояния»),
// довели до сборки и первую не убрали.
//
// Цена раскола была видна человеку: кнопка EN переключала навбар, но не тело
// страницы; до нидерландского из интерфейса было не добраться вовсе; навбар
// говорил «Mes articles», а заголовок той же страницы — «Mes outils».
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

export const LANGUAGES = ['fr', 'en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'rentit_lang';

const isLanguage = (value: string | null | undefined): value is Language =>
  Boolean(value) && (LANGUAGES as readonly string[]).includes(value as string);

/**
 * Язык из адреса: `?lang=nl`.
 *
 * ЗАЧЕМ. index.html объявляет поисковику три языковые версии:
 *   <link rel="alternate" hreflang="nl" href="…/?lang=nl" />
 * Параметр при этом не читал НИКТО — язык брался только из localStorage,
 * и по всем трём адресам отдавался французский. Объявление было ложным:
 * Google шёл по ссылке за нидерландской версией и получал французскую.
 *
 * Чинить это можно было двумя способами — убрать объявление или сделать
 * его правдой. Второе не только честнее, но и полезнее: ссылка, открытая
 * соседом-фламандцем, наконец открывается на его языке. До сих пор язык
 * ссылки задавался тем, что лежит в ЕГО браузере, то есть отправитель не
 * мог повлиять на это никак.
 *
 * Выбор из адреса сохраняется (через `languageChanged` ниже) — иначе
 * переход на вторую страницу вернул бы человека обратно во французский.
 */
function languageFromUrl(): Language | null {
  try {
    const value = new URLSearchParams(window.location.search).get('lang');
    return isLanguage(value) ? value : null;
  } catch {
    /* адреса может не быть вовсе — например, в юнит-прогоне */
    return null;
  }
}

// Выбор языка обязан пережить перезагрузку. Самописная система его хранила,
// react-i18next был настроен на жёсткое lng: 'fr' — при сведении это молча
// потерялось бы, и человек возвращался бы во французский на каждой странице.
function storedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    /* приватный режим — переживём без сохранения */
  }
  return 'fr';
}

/**
 * Адрес важнее сохранённого.
 *
 * Человек, открывший `?lang=nl`, сказал про язык ПРЯМО СЕЙЧАС, а запись
 * в хранилище — про какой-то прошлый раз. Обратный порядок означал бы,
 * что присланная ссылка не работает ровно у тех, кто уже бывал на сайте.
 */
function initialLanguage(): Language {
  return languageFromUrl() ?? storedLanguage();
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      nl: { translation: nl },
    },
    lng: initialLanguage(),
    // Основной язык продукта французский: если ключ потеряется, честнее
    // показать французский текст, чем английский посреди французской страницы.
    fallbackLng: 'fr',
    interpolation: { escapeValue: false }, // react уже защищает от XSS
  });

/**
 * Атрибут `lang` у документа следует за выбором.
 *
 * В index.html написано `<html lang="fr">`, и это значение не менял никто
 * и никогда. Последствия не косметические:
 *
 *   • программа чтения с экрана берёт из него ПРОИЗНОШЕНИЕ. Нидерландский
 *     текст, объявленный французским, читается вслух французскими
 *     звуками — то есть не читается;
 *   • браузер по нему выбирает правила переноса и предлагает перевод
 *     страницы;
 *   • поисковик считает страницу французской, что бы на ней ни стояло.
 *
 * Регион не дописываем: продукт различает три языка, а не пять рынков.
 */
function applyDocumentLanguage(lang: string): void {
  const short = LANGUAGES.find(l => lang?.startsWith(l)) ?? 'fr';
  try {
    document.documentElement.lang = short;
  } catch {
    /* документа может не быть — юнит-прогон */
  }
}

applyDocumentLanguage(i18n.language);

/**
 * Язык, пришедший из адреса, сохраняется ЯВНО.
 *
 * Тонкость, которую видно только в браузере: `languageChanged` не
 * срабатывает, когда язык задан через `lng` при инициализации — менять
 * было не с чего. Замер это показал сразу: `?lang=nl` открывал
 * нидерландскую страницу, а следующий заход на сайт возвращал
 * французскую, и присланная ссылка работала ровно один раз.
 *
 * Почему сохраняем, а не оставляем разовым. Получатель ссылки на
 * нидерландском — скорее всего, тот, кто на нём и читает; у него в
 * хранилище пусто, и без записи он получил бы французский. Вернуть
 * прежний язык — одно нажатие в шапке.
 */
const fromUrl = languageFromUrl();
if (fromUrl) {
  try {
    localStorage.setItem(STORAGE_KEY, fromUrl);
  } catch {
    /* приватный режим */
  }
}

i18n.on('languageChanged', lang => {
  applyDocumentLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* приватный режим */
  }
});

export default i18n;
