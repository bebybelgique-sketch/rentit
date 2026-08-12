import { expect, type Page } from '@playwright/test'

/**
 * Видимый текст интерфейса — одним списком.
 *
 * Мартовский набор тестов сверялся с английскими подписями, вшитыми в каждый
 * файл. Интерфейс с тех пор стал французским, и 10 проверок из 20 упавших
 * 11.08 упали ровно на этом: `Browse` против `Parcourir`, `Log in` против
 * `Se connecter`, `Page not found` против `Page introuvable`. Продукт при этом
 * был исправен.
 *
 * Теперь подпись живёт в одном месте: правка копирайта — одна строка здесь,
 * а не обход восьми файлов. Там, где можно опереться на роль, placeholder или
 * href, тексту предпочитаем их — они переживают и смену языка.
 */
export const UI = {
  // Баннер cookies. Внимание: он англоязычный и не переведён — это не описка
  // теста, а состояние продукта на 11.08 (навбар при этом французский).
  cookieAcceptAll: 'Accept all cookies',
  cookieDeclineOptional: 'Decline optional',
  cookieManage: 'Manage preferences',
  cookieHeading: 'This site uses cookies',

  // 12.08, сведение словарей: навбар говорил чужим словом. Продукт сдаёт
  // инструменты, а не «articles», и глаголы согласованы между собой —
  // Parcourir · Se connecter · S'inscrire, а не глагол вперемешку с
  // существительными.
  navBrowse: 'Parcourir',
  navLogin: 'Se connecter',
  navSignup: "S'inscrire",
  navLogout: 'Déconnexion',
  navMyItems: 'Mes outils',

  loginHeading: 'Se connecter à RentIt',
  loginSubmit: 'Se connecter',

  notFound: 'Page introuvable',

  browseEmptyHeading: 'Aucun outil dans cette zone',
  browseSearchPlaceholder: 'Rechercher des outils...',
  nearby: '📍 À proximité',

  myItemsHeading: 'Mes outils',
  myItemsEmpty: "Aucun outil pour l'instant",
  itemView: 'Voir',
  itemDelete: 'Supprimer',

  listItemTitleLabel: "Titre de l'outil *",
  listItemPriceLabel: 'Prix par jour (€) *',
  listItemSubmit: "Publier l'annonce",
  listItemNeedsPhoto: 'Ajoutez une photo de profil',

  profileAvatarLabel: "URL de l'avatar",
  profileSubmit: 'Mettre à jour le profil',
  profileSaved: 'Profil mis à jour avec succès!',
} as const

/** Категории витрины: значение в базе → подпись на экране. */
export const CATEGORY_LABEL = {
  power_tools: '⚡ Électroportatif',
  hand_tools: '🔧 Outillage manuel',
  garden: '🌿 Jardinage',
  construction: '🏗️ Construction',
  cleaning: '🧹 Nettoyage',
  measuring: '📐 Mesure & Détection',
} as const

/**
 * Баннер cookies перекрывает меню (см. коммит 22c0f7e), поэтому его надо
 * убрать до любого клика. Отсутствие баннера — не ошибка: на втором визите
 * согласие уже лежит в localStorage.
 */
export async function dismissCookies(page: Page) {
  const button = page.getByRole('button', { name: UI.cookieAcceptAll })
  if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
    await button.click()
    await expect(button).toBeHidden({ timeout: 5000 })
  }
}

/**
 * Проставляет согласие и выбранный профиль до загрузки страницы — так модалки
 * не появляются вовсе и не воруют клики у теста.
 */
export async function skipModals(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'rentit_cookie_consent',
      JSON.stringify({ necessary: true, functional: true, analytics: true }),
    )
    localStorage.setItem('rentit_profile_selected', 'individual')
  })
}

/**
 * Выполняет действие, которое открывает confirm() или prompt(), и отвечает
 * на него — ровно на время этого действия.
 *
 * Постоянный `page.on('dialog', …)` здесь опасен, и это не теория: обработчик
 * из createItem («да» на вопрос о дубле, БЕЗ текста) оставался висеть на
 * странице и потом первым перехватывал prompt «почему отменяете». Причина
 * уходила пустой, edge-функция писала cancellation_reason = null, и это
 * выглядело как потеря причины продуктом. Продукт был ни при чём.
 *
 * `answer`: строка — ответ на prompt; true — просто «да» для confirm.
 */
export async function withDialog(
  page: Page,
  answer: string | true,
  action: () => Promise<void>,
) {
  const handler = (dialog: import('@playwright/test').Dialog) => {
    const reply = typeof answer === 'string' ? dialog.accept(answer) : dialog.accept()
    reply.catch(() => { /* диалог мог быть закрыт другим обработчиком */ })
  }
  page.on('dialog', handler)
  try {
    await action()
    // Диалог может открыться на волосок позже, чем разрешится клик.
    await page.waitForTimeout(500)
  } finally {
    page.off('dialog', handler)
  }
}

/**
 * Полный выход: сессия Supabase лежит в localStorage, поэтому её недостаточно
 * «перелогинить» — старую надо стереть до загрузки приложения.
 */
export async function logout(page: Page) {
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.context().clearCookies()
}

/**
 * Вход под конкретным пользователем.
 *
 * Прежняя сессия сбрасывается ПЕРЕД входом, и это не перестраховка. Проверка
 * «вошли» опирается на кнопку «Déconnexion» в навбаре, а она уже висит там от
 * предыдущего пользователя: без сброса функция возвращалась мгновенно, тест
 * продолжался под чужой личностью, и владелец шёл бронировать собственный
 * инструмент — календаря на такой странице нет, отсюда «ноль свободных дней».
 * Ошибка выглядела как поломка календаря, хотя календарь исправен.
 *
 * После сброса «Déconnexion» на экране может появиться только от этого входа.
 * Неверный пароль сюда же и приведёт: покажется .error-msg, кнопка не придёт,
 * ожидание упадёт по таймауту — то есть провалится вход, а не следующий шаг.
 */
export async function login(page: Page, email: string, password: string) {
  await logout(page)

  await page.goto('/login', { waitUntil: 'load' })
  await dismissCookies(page)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('button', { name: UI.navLogout })).toBeVisible({ timeout: 20000 })
}
