// Снимает с живого продукта то, что человек реально видит: текст после
// отрисовки и скриншот, на телефоне и на десктопе.
//
// Зачем. Приложение — клиентский SPA: любой маршрут отдаёт одну и ту же
// оболочку, и содержимое появляется только после исполнения скриптов.
// Инструмент, который умеет лишь скачать HTML, видит на всех страницах
// одинаковый пустой каркас. Qwen 11.08 на этом и споткнулся: не смог
// ничего осмотреть и выдал вымышленную находку в формате отчёта.
//
// Результат кладётся в capture/ (в git не идёт) — текст для разбора,
// картинки для взгляда.
//
// Запуск: node scripts/capture-pages.mjs

import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'capture');

const readEnv = () => {
  try {
    return Object.fromEntries(
      readFileSync(join(root, '.env'), 'utf8').split('\n').map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  } catch { return {}; }
};

const env = { ...readEnv(), ...process.env };
const BASE = env.E2E_BASE_URL || 'https://rentit-plum.vercel.app';

const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'browse', path: '/browse' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'terms', path: '/terms' },
  { name: 'privacy', path: '/privacy' },
];

const VIEWS = [
  { name: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
  { name: 'mobile', opts: { ...devices['Pixel 5'] } },
];

// Баннер cookies перекрывает экран и на телефоне раньше блокировал меню.
// Снимаем оба состояния: как встречает новичка и как выглядит после согласия.
const acceptCookies = async (page) => {
  const btn = page.getByRole('button', { name: /accept all cookies/i });
  if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(300);
  }
};

const visibleText = (page) => page.evaluate(() => {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
  const out = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      return;
    }
    if (node.nodeType !== 1) return;
    if (skip.has(node.tagName)) return;
    const cs = getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    for (const child of node.childNodes) walk(child);
  };
  walk(document.body);
  return out.join('\n');
});

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const index = [];

  for (const view of VIEWS) {
    const ctx = await browser.newContext(view.opts);
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const url = BASE + p.path;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      } catch {
        // networkidle не всегда наступает; содержимое к этому моменту уже есть.
        await page.waitForTimeout(2000);
      }
      await acceptCookies(page);
      await page.waitForTimeout(600);

      const text = await visibleText(page);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);

      const stem = `${p.name}-${view.name}`;
      writeFileSync(join(OUT, `${stem}.txt`), `# ${url}  (${view.name})\n# горизонтальный вылет: ${overflow}px\n\n${text}\n`);
      await page.screenshot({ path: join(OUT, `${stem}.png`), fullPage: true });

      index.push({ page: p.name, view: view.name, url, chars: text.length, overflow });
      console.log(`${stem.padEnd(20)} ${String(text.length).padStart(6)} символов  вылет ${overflow}px`);
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\nГотово: ${index.length} снимков в capture/`);
};

main().catch((e) => { console.error('СБОЙ:', e.message); process.exit(1); });
