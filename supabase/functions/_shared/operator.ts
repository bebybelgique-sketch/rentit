// Единственное место, где записаны адрес сайта и личность оператора.
//
// Живёт в _shared, а не в src/, потому что этим знанием пользуются ОБЕ
// стороны: юридические страницы в браузере и письма из edge-функций.
// Двумя копиями они разошлись бы молча — ровно так и было до 14.08:
// на страницах фигурировал `rentit.be`, в письмах `rentit.app`, и ни
// один из двух доменов нам не принадлежит.
//
// src/domain/operator.ts — реэкспорт этого файла, не копия (тот же приём,
// что у pricing.ts).
//
// ⚠️ ДОМЕН ВРЕМЕННЫЙ. `rentit.be` занят: реестр DNS Belgium отвечает
// NOT AVAILABLE, домен припаркован у стороннего лица. Пока свой домен не
// куплен, сайт живёт на адресе Vercel. Когда домен появится — правится
// РОВНО ОДНА строка ниже, плюс секреты APP_URL и FROM_EMAIL в Supabase.

/** Домен, по которому продукт реально открывается. */
export const SITE_DOMAIN = 'rentit-plum.vercel.app'

/** Адрес сайта. Им же подставляются ссылки в письмах (APP_URL). */
export const SITE_URL = `https://${SITE_DOMAIN}`

/** Имя платформы. Это НЕ ответственный за обработку данных. */
export const PLATFORM_NAME = 'RentIt'

// Ответственный за обработку данных по GDPR — физическое лицо, а не
// «RentIt». Совпадает слово в слово с уже опубликованными Mentions
// Légales garageforall.be, чтобы два сайта одного человека не называли
// его по-разному.
export const OPERATOR_NAME = 'Osmonov Muratbek'
export const OPERATOR_ADDRESS = '1457 Walhain, Belgique'

/** Правовой статус оператора на трёх языках документа. */
export const OPERATOR_STATUS = {
  fr: 'personne physique',
  en: 'natural person',
  nl: 'natuurlijke persoon',
} as const

// ⚠️ ВРЕМЕННЫЙ ЯЩИК, меняется вместе с доменом на support@<домен>.
// Плюс-адресация Gmail: письмо доезжает в тот же ящик, но отделяется
// фильтром и не смешивается с личной почтой. Прежние privacy@ / legal@ /
// support@rentit.be не просто не работали — они направляли запросы по
// GDPR на домен ПОСТОРОННЕГО лица.
export const CONTACT_EMAIL = 'bebybelgique+rentit@gmail.com'
