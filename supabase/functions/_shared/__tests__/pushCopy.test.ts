import { describe, it, expect } from 'vitest'
import {
  renderPush, shortName, shortItem, dateRange, money, preview, maskSensitive,
  bookingTopic, bookingTag, bookingUrl,
  PUSH_KINDS, PUSH_LANGS, ITEM_MAX, PREVIEW_MAX, MASK,
  type PushFacts,
} from '../pushCopy'
import { isValidTopic } from '../webPush'

/**
 * Тексты push-уведомлений.
 *
 * Уведомление живёт на экране блокировки — его видят посторонние. Отсюда
 * два главных правила пакета, и оба проверяются здесь на ЛЮБЫХ данных, а
 * не на паре примеров: номер телефона не попадает на экран никогда, и
 * уведомление не обещает того, чего продукт не делает.
 */

const full: PushFacts = {
  itemTitle: 'Perforateur SDS Bosch',
  ownerName: 'Ramzan Bekov',
  otherName: 'Julien Vermeulen',
  startDate: '2026-09-20',
  endDate: '2026-09-21',
  totalPrice: 36,
  messageBody: 'Le nettoyeur est prêt, il est sous l’auvent à droite du portail.',
}

describe('сверка с экраном E пакета Design', () => {
  it('новая заявка — слово в слово', () => {
    const r = renderPush('new_request', 'fr', {
      itemTitle: 'Scie circulaire Makita', otherName: 'Julien Vermeulen',
      startDate: '2026-09-24', endDate: '2026-09-26', totalPrice: 45,
    })
    expect(r.title).toBe('Demande pour « Scie circulaire Makita »')
    expect(r.body).toBe('Julien V. · 24 → 26 sept. · €45. Répondez sous 24 h.')
  })

  it('новое сообщение — слово в слово', () => {
    const r = renderPush('new_message', 'fr', {
      otherName: 'Sophie Lambert',
      messageBody: "Le nettoyeur est prêt, il est sous l'auvent à droite du portail.",
    })
    expect(r.title).toBe('Sophie L. · nouveau message')
    expect(r.body).toBe("Le nettoyeur est prêt, il est sous l'auvent à droite du portail.")
  })

  /**
   * НАМЕРЕННОЕ отступление: пакет обещал номер, продукт номер не
   * показывает. Разбор — в шапке события `accepted` в pushCopy.ts.
   */
  it('принято — зовёт договориться в переписке, а не смотреть номер', () => {
    const r = renderPush('accepted', 'fr', full)
    expect(r.title).toBe('Ramzan B. a accepté')
    expect(r.body).toBe("Perforateur SDS Bosch, 20 → 21 sept. Ouvrez pour convenir du lieu et de l'heure.")
  })
})

describe('ни одно уведомление не обещает номер телефона', () => {
  /**
   * Продукт номер не показывает: колонки phone закрыты миграцией
   * 20260811000014. Обещание «откройте — увидите номер» было бы ложью,
   * которую человек обнаружит сразу же. Сторож на то, чтобы оно не
   * вернулось ни на каком языке.
   */
  it.each(PUSH_LANGS)('%s', (lang) => {
    for (const kind of PUSH_KINDS) {
      const { title, body } = renderPush(kind, lang, full)
      expect(`${title} ${body}`, `${lang}/${kind}`).not.toMatch(/numéro|nummer|number|téléphone|telefoon|phone/i)
    }
  })
})

describe('каждое событие на каждом языке собирается целиком', () => {
  for (const lang of PUSH_LANGS) {
    for (const kind of PUSH_KINDS) {
      it(`${lang} · ${kind}`, () => {
        const { title, body } = renderPush(kind, lang, full)
        expect(title.length).toBeGreaterThan(2)
        expect(body.length).toBeGreaterThan(2)
        // Неподставленная {метка} на экране — самый дешёвый способ
        // выглядеть сломанным.
        expect(`${title} ${body}`).not.toMatch(/\{\w+\}/)
        // Точка сокращения месяца + точка шаблона давали «sept.. » —
        // поймано этим набором на первом прогоне.
        expect(`${title} ${body}`, `${lang}/${kind}`).not.toMatch(/\.\./)
      })
    }
  }
})

describe('номер телефона не попадает на экран блокировки', () => {
  const PHONES = [
    '+32 475 12 34 56', '+32475123456', '0032 475 12 34 56', '0475 12 34 56',
    '0475/12.34.56', '0475-12-34-56', '0475 123 456', '04 75 12 34 56',
    '02 123 45 67', '010 12 34 56', '+32 (0)475 12.34.56', '0475 / 12 34 56',
    '+33 6 12 34 56 78', '06 12 34 56 78', '+31 6 12345678', '0612345678',
  ]

  it.each(PHONES)('скрыт: %s', (phone) => {
    const out = preview(`Appelle-moi au ${phone} demain`)
    expect(out).toContain(MASK)
    expect(out).not.toMatch(/\d{3}/)
  })

  /**
   * Сотни номеров в разной записи, вставленные в случайное место случайной
   * фразы. После маски в превью не должно остаться ни одной цепочки из 9
   * цифр — даже если номер стоял на границе обрезки в 90 знаков.
   */
  it('на любых данных: ни одной цепочки из 9 цифр', () => {
    let seed = 22_09_2026
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const digit = () => String(Math.floor(rnd() * 10))
    const sep = () => ['', ' ', '.', '-', '/', ' / ', '  '][Math.floor(rnd() * 7)]
    const words = ['Salut', 'je', 'passe', 'vers', '18h', 'ok', 'merci', 'la', 'perceuse', 'est', 'prête', 'au', 'garage']

    for (let i = 0; i < 400; i++) {
      const prefix = ['', '+32 ', '0032 ', '+33 ', '0'][Math.floor(rnd() * 5)]
      const groups = 3 + Math.floor(rnd() * 3)
      let phone = prefix + '4' + digit() + digit()
      for (let g = 0; g < groups; g++) phone += sep() + digit() + digit()

      const before = Array.from({ length: Math.floor(rnd() * 20) }, () => words[Math.floor(rnd() * words.length)]).join(' ')
      const after = Array.from({ length: Math.floor(rnd() * 8) }, () => words[Math.floor(rnd() * words.length)]).join(' ')
      const out = preview(`${before} ${phone} ${after}`)

      const digitsOnly = out.replace(/[^\d]/g, ' ').split(/\s+/).join('')
      expect(out, `утёк номер из «${before} ${phone} ${after}»`).not.toMatch(/\d(?:[\s.\-/()]{0,3}\d){8,}/)
      expect(digitsOnly.length, out).toBeLessThan(9)
    }
  })

  it('многоточие в чужом сообщении не схлопывается', () => {
    expect(renderPush('new_message', 'fr', { otherName: 'Ana P', messageBody: 'ok... à demain..' }).body)
      .toBe('ok... à demain..')
  })

  it('дата уцелела — у неё 8 цифр, у номера от 9', () => {
    expect(preview('Rendez-vous le 20/09/2026 à 14h')).toBe('Rendez-vous le 20/09/2026 à 14h')
  })

  it('почтовый адрес — тоже скрыт', () => {
    expect(maskSensitive('écris à jean.dupont+outils@example.be stp')).toBe(`écris à ${MASK} stp`)
  })

  it('IBAN — под тем же правилом', () => {
    expect(maskSensitive('vire sur BE71 0961 2345 6769')).not.toMatch(/0961/)
  })
})

describe('подстановки — правила пакета', () => {
  it('имя: имя и инициал фамилии', () => {
    expect(shortName('Ramzan Bekov')).toBe('Ramzan B.')
    expect(shortName('  Élodie   van der Berg ')).toBe('Élodie B.')
    expect(shortName('Madonna')).toBe('Madonna')
    expect(shortName('')).toBeNull()
    expect(shortName(null)).toBeNull()
  })

  it('название вещи — не длиннее 32 знаков', () => {
    const long = 'Nettoyeur haute pression Kärcher K5 Premium Full Control'
    const out = shortItem(long)!
    expect(Array.from(out).length).toBe(ITEM_MAX)
    expect(out.endsWith('…')).toBe(true)
    expect(shortItem('Perceuse')).toBe('Perceuse')
  })

  it('обрезка по знакам: эмодзи не рвётся пополам', () => {
    const out = shortItem('🔨'.repeat(40))!
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })

  it('превью — не длиннее 90 знаков', () => {
    const out = preview('a'.repeat(200))
    expect(Array.from(out).length).toBe(PREVIEW_MAX)
  })

  it('даты: один день, месяц, стык месяцев, стык лет', () => {
    expect(dateRange('2026-09-20', '2026-09-20', 'fr')).toBe('20 sept.')
    expect(dateRange('2026-09-20', '2026-09-21', 'fr')).toBe('20 → 21 sept.')
    expect(dateRange('2026-09-30', '2026-10-02', 'fr')).toBe('30 sept. → 2 oct.')
    expect(dateRange('2026-12-30', '2027-01-02', 'fr')).toBe('30 déc. 2026 → 2 janv. 2027')
    expect(dateRange('2026-09-20', '2026-09-21', 'nl')).toBe('20 → 21 sep.')
    expect(dateRange('2026-09-20', '2026-09-21', 'en')).toBe('20 → 21 Sep')
    expect(dateRange('мусор', null, 'fr')).toBeNull()
  })

  it('сумма — как цены в продукте', () => {
    expect(money(45)).toBe('€45')
    expect(money('36.00')).toBe('€36')
    expect(money(45.5)).toBe('€45.50')
    expect(money(null)).toBeNull()
  })
})

describe('пустое имя — фраза остаётся грамотной', () => {
  const noNames: PushFacts = { ...full, ownerName: '', otherName: '   ' }

  it.each([
    ['fr', 'accepted', 'Votre voisin a accepté'],
    ['fr', 'expired_renter', 'Pas de réponse de votre voisin'],
    ['nl', 'accepted', 'Je buur heeft aanvaard'],
    ['nl', 'expired_renter', 'Geen antwoord van je buur'],
    ['en', 'accepted', 'Your neighbour accepted'],
    ['en', 'expired_renter', 'No reply from your neighbour'],
  ] as const)('%s · %s → «%s»', (lang, kind, title) => {
    expect(renderPush(kind, lang, noNames).title).toBe(title)
  })

  it('имя в начале тела — с заглавной', () => {
    expect(renderPush('new_request', 'fr', noNames).body.startsWith('Un voisin · ')).toBe(true)
    expect(renderPush('expired_owner', 'en', noNames).body.startsWith('A neighbour got no reply')).toBe(true)
  })

  /**
   * Заглавная ставится ТОЛЬКО запасному слову. Название, которое человек
   * написал со строчной, остаётся как написано.
   */
  it('чужой текст не трогается', () => {
    const r = renderPush('accepted', 'en', { ...full, itemTitle: 'iPhone tripod' })
    expect(r.body.startsWith('iPhone tripod,')).toBe(true)
  })
})

describe('одна бронь — одно место на экране', () => {
  const id = '3f2c9a1b-8e7d-4c6f-a0b1-c2d3e4f5a6b7'

  it('тег по брони', () => {
    expect(bookingTag(id)).toBe(`booking-${id}`)
  })

  it('тема для службы — 32 знака, годится по RFC', () => {
    expect(bookingTopic(id)).toHaveLength(32)
    expect(isValidTopic(bookingTopic(id))).toBe(true)
  })

  it('ссылка — на существующий экран брони', () => {
    expect(bookingUrl(id)).toBe(`/my-rentals?booking=${id}`)
  })
})
