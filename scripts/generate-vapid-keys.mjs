// Пара ключей VAPID для push-уведомлений.
//
// ЗАКРЫТЫЙ КЛЮЧ НЕ ПЕЧАТАЕТСЯ НИКОГДА. Он пишется сразу в файл, путь к
// которому передан аргументом, — и из этого файла уходит в секреты
// Supabase командой `supabase secrets set --env-file <файл>`, не проходя
// через командную строку (её история и логи живут дольше, чем кажется).
// В вывод попадает только публичный ключ: он и так уезжает каждому
// браузеру.
//
// КОГДА НУЖНА НОВАЯ ПАРА. Почти никогда: подписки браузеров привязаны к
// публичному ключу, и смена пары делает недействительными ВСЕ подписки
// разом — каждому придётся подписываться заново. Поэтому файл с парой
// хранится (вне репозитория), а не выбрасывается после выката.
//
// ЗАПУСК: node scripts/generate-vapid-keys.mjs <путь-к-файлу.env>
// Файл не перезаписывается: существующая пара — это действующие подписки.

import { existsSync, writeFileSync } from 'node:fs'

const target = process.argv[2]
if (!target) {
  console.error('укажите путь к файлу: node scripts/generate-vapid-keys.mjs <путь.env>')
  process.exit(1)
}
if (existsSync(target)) {
  console.error(`${target} уже существует. Новая пара сделала бы недействительными все подписки — не перезаписываю.`)
  process.exit(1)
}

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey)

writeFileSync(
  target,
  [
    `# RentIt · VAPID · создано ${new Date().toISOString()}`,
    '# Смена пары делает недействительными ВСЕ подписки браузеров.',
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${d}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
)

console.log(`пара записана в ${target}`)
console.log(`публичный ключ: ${publicKey}`)
