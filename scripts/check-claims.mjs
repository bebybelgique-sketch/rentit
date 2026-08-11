// Страж утверждений: ловит в интерфейсе обещания, которых продукт не даёт.
//
// Повод. 11.08 из витрины и условий были вычищены Stripe, escrow, комиссия
// и страховка — и при этом на проде остался блок «Protection dommages ·
// €500 · incluse dans chaque location». Скан по словам его не увидел: там
// нет ни «assurance», ни «Protection incluse». Вывод: поиск по отдельным
// словам не может быть контролем. Нужны инварианты.
//
// Инварианты RentIt (бесплатная модель, решение из плана 11.08):
//   — платформа не принимает и не держит денег;
//   — платформа не страхует и не покрывает ущерб;
//   — платформа не берёт комиссию;
//   — переписка идёт внутри брони, не через WhatsApp.
//
// Правило срабатывает не на слово, а на СОЧЕТАНИЕ: слово о защите рядом с
// суммой или обещанием включённости. Именно эта пара и была пропущена.
//
// Запуск: node scripts/check-claims.mjs
// В наборе тестов: src/__tests__/claims.test.ts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src'];
const SCAN_EXT = /\.(ts|tsx|json)$/;

// Формулировки, которые выглядят как нарушение, но верны по существу.
// Список намеренно из точных фраз, а не из шаблонов: широкий шаблон в
// исключениях однажды пропустит настоящее обещание.
const ALLOWED = [
  // Прямые отрицания — ради них слово и остаётся в тексте.
  'RentIt ne fournit aucune assurance',
  'RentIt biedt geen verzekering',
  'RentIt provides no insurance',
  'Pas d\'assurance, pas de promesse à votre place',
  // Совет проверить СВОЮ страховку.
  'Vérifiez si votre assurance',
  'responsabilité civile familiale',
  'familiale burgerlijke aansprakelijkheidsverzekering',
  'Check whether your home insurance',
  // Орган по защите данных — не «защита» в смысле покрытия ущерба.
  'protection des données',
  'Data Protection Authority',
  'Autorité de protection',
  'dataprotectionauthority',
  'gegevensbescherming',
  'Gegevensbeschermingsautoriteit',
  // Фотографии действительно защищают обе стороны — это про доказательство,
  // а не про выплату.
  'protège les deux parties',
  'protects both parties',
  'beschermt beide partijen',
  // Прямые отрицания приёма денег — ради них слово «paiement» и стоит.
  'Aucun paiement en ligne',
  'aucun paiement ne transite',
  'Aucun paiement ne transite',
  'No payment goes through',
  'no payment passes through',
  'Er verloopt geen enkele betaling',
  'geen betaling via het platform',
  'ne demandons ni ne conservons aucune coordonnée bancaire',
  'never see, ask for or store',
  'Wij zien, vragen of bewaren geen enkel bank',
  'RentIt ne détient aucun fonds',
  'RentIt holds no funds',
  'RentIt houdt geen geld aan',
  'RentIt n\'a rien à rembourser',
  'nothing for RentIt to refund',
  'heeft RentIt niets terug te betalen',
  // Комиссии сегодня действительно нет — утверждение верное.
  "l: 'Commission'",
  'ne prélève aucune commission',
  'takes no commission',
  'neemt geen commissie',
  // Политика описывает саму практику обращения с телефоном — это и есть
  // то обещание, которому теперь соответствуют права в базе.
  'phone number shared with the other party only after a booking is confirmed',
  'numéro de téléphone communiqué à l\'autre partie uniquement après confirmation',
  'telefoonnummer gedeeld met de andere partij pas na bevestiging',
];

const RULES = [
  {
    name: 'Обещание страховки или покрытия ущерба',
    why: 'Платформа не сторона договора и ущерб не покрывает.',
    word: /(assurance|insurance|verzekering|verzekerd|bescherming|protection|protectie|couverture|couvre|couvert|dekt|dekking|garantie|guarantee|waarborg|indemnis|compensation)/i,
    near: /(€\s?\d|\d+\s?€|EUR\s?\d|jusqu'?à|up to|tot\s+\d|inclus|incluse|included|inbegrepen|automatiquement|automatically|chaque location|每|par jour|per dag|per day)/i,
  },
  {
    name: 'Приём денег платформой',
    why: 'Расчёт наличными между сторонами; платформа денег не касается.',
    word: /(paiement|payment|betaling|payer|encaiss|versement|virement|payout|uitbetaling|remboursement|refund|terugbetaling)/i,
    near: /(sécuris|secure|automatique|automatic|en ligne|online|par la plateforme|via RentIt|door het platform)/i,
  },
  {
    name: 'Комиссия платформы',
    why: 'Комиссии нет; с расчёта наличными её и взять неоткуда.',
    word: /(commission|frais de plateforme|frais plateforme|platform fee|platformcommissie|platformkosten)/i,
    near: /(\d\s?%|%|\d+\s?€|€\s?\d|prélev|retenu|déduit|ingehouden|deducted)/i,
  },
];

// Слова, само присутствие которых в интерфейсе — уже нарушение.
const FORBIDDEN_WORDS = [
  { word: /\bescrow\b/i, why: 'Средства на площадке не депонируются.' },
  { word: /\bStripe\b/, why: 'Платёжный провайдер не подключён.' },
  { word: /\bPCI-?DSS\b/i, why: 'Карточные данные не обрабатываются.' },
  { word: /\bWhatsApp\b/i, why: 'Переписка живёт внутри брони.' },
  // Опасна не сама ссылка, а номер в ней: wa.me/<телефон>. Кнопка
  // «поделиться» шлёт wa.me/?text=… без номера и никого не раскрывает.
  { word: /wa\.me\/[^?\s'"`]/i, why: 'Ссылка вида wa.me/<номер> раскрывает чужой телефон.' },
  { word: /users[^)]*\bphone\b(?!_verified)/, why: 'Телефон закрыт от чтения: контакт только после подтверждённой брони.' },
];

// pending_payment намеренно НЕ запрещён. Значение живёт в enum базы с
// марта, и код обязан обрабатывать его при отображении старых броней.
// Правило, которое ругается на защитную обработку, приучает не смотреть
// на стража — а это дороже, чем сама находка.

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) {
    return f === 'node_modules' || f === '__tests__' ? [] : walk(p);
  }
  return SCAN_EXT.test(f) ? [p] : [];
});

// Комментарии — это разговор разработчиков между собой, а не обещание
// пользователю. Половина сегодняшних правок объясняет в комментарии, что
// именно было убрано, и страж не должен спотыкаться об эти объяснения.
//
// Вырезать построчно нельзя: пояснения в JSX идут блоками {/* ... */} на
// несколько строк, и построчный разбор видел бы в них «€500» как живое
// обещание. Поэтому блочные комментарии снимаются со всего файла разом,
// с сохранением числа строк — иначе номера в отчёте перестанут сходиться
// с файлом, и находку будет не найти.
const stripComments = (source) =>
  source
    // Переносы нормализуются первым делом. В JavaScript «.» не совпадает
    // с \r — это терминатор строки, — поэтому в файле с окончаниями CRLF
    // шаблон «//…до конца строки» не срабатывал, и строчные комментарии
    // не вырезались. Страж молча менял ответ в зависимости от того, как
    // git выдал файл на диск: на ветке (LF) был чист, сразу после
    // checkout (CRLF) выдал два нарушения на собственные комментарии.
    // Чинить делением по /\r?\n/ мало: одиночный \r так и остаётся.
    .replace(/\r\n?/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    // Двойной слэш после двоеточия — это схема URL, а не комментарий.
    // Без этой оговорки строка «https://wa.me/<номер>» обрезалась до
    // «https:» и нарушение исчезало: страж отвечал «чисто» именно там,
    // где смотреть и надо. Поймано собственным тестом стража.
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'));

// Разбор одной строки. Вынесен наружу, чтобы стража можно было проверить
// самого: правило, которое никогда не срабатывало, неотличимо от сломанного.
export const checkText = (text) => {
  const found = [];
  for (const line of stripComments(text)) {
    if (!line.trim()) continue;
    if (ALLOWED.some((a) => line.includes(a))) continue;
    for (const rule of RULES) {
      if (rule.word.test(line) && rule.near.test(line)) {
        found.push({ rule: rule.name, why: rule.why, text: line.trim().slice(0, 140) });
      }
    }
    for (const f of FORBIDDEN_WORDS) {
      if (f.word.test(line)) {
        found.push({ rule: `Запрещённое слово: ${f.word.source}`, why: f.why, text: line.trim().slice(0, 140) });
      }
    }
  }
  return found;
};

export const findClaimViolations = () => {
  const violations = [];

  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(root, dir))) {
      const rel = relative(root, file).replace(/\\/g, '/');
      const lines = stripComments(readFileSync(file, 'utf8'));

      lines.forEach((line, i) => {
        for (const found of checkText(line)) {
          violations.push({ file: rel, line: i + 1, ...found });
        }
      });
    }
  }

  return violations;
};

// Прямой запуск: печатаем и возвращаем код.
if (process.argv[1] && process.argv[1].endsWith('check-claims.mjs')) {
  const v = findClaimViolations();
  if (v.length === 0) {
    console.log('Страж утверждений: нарушений нет.');
    process.exit(0);
  }
  console.log(`Страж утверждений: ${v.length} нарушени(й)\n`);
  for (const x of v) {
    console.log(`${x.file}:${x.line}`);
    console.log(`  ${x.rule}`);
    console.log(`  Почему: ${x.why}`);
    console.log(`  Строка: ${x.text}\n`);
  }
  process.exit(1);
}
