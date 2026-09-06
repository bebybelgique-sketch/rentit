// src/pages/__tests__/AuthForms.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { AuthError } from '@supabase/supabase-js'
import i18n, { type Language } from '../../i18n-next'
import Register from '../Register'
import Login from '../Login'
import { supabase } from '../../lib/supabase'

// ЯЗЫК ФИКСИРУЕТ ОБВЯЗКА, а не матчер.
//
// Прежняя версия этого файла искала поля альтернацией
// /Password|Mot de passe|Wachtwoord/i и сообщение — альтернацией
// /check your inbox|vérifiez|controleer|bevestig/i. Такой тест зелёный при
// любом из трёх языков, то есть не проверяет ничего из того, что видит
// человек: подставь словарь не тот (или покажи вместо «подтвердите почту»
// сообщение страницы входа — у них общее начало) — тест останется зелёным.
//
// Поэтому язык здесь задаётся через i18n.changeLanguage + I18nextProvider, а
// утверждения написаны точными строками того языка, в котором идёт тест.
// Отдельная проверка ниже проходит по всем трём языкам и утверждает, что
// строка СВОЕГО языка на экране есть, а двух чужих — нет.

const navigateMock = vi.hoisted(() => vi.fn())
const searchParamsMock = vi.hoisted(() => ({ value: new URLSearchParams() }))

// Цепочка запроса за реферером собрана здесь, а не через
// mockReturnValue({...} as any): типизированные заглушки не требуют
// приведения к PostgrestFilterBuilder, который руками не собрать.
const dbMocks = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { from, select, eq, maybeSingle }
})

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsMock.value],
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
    from: dbMocks.from,
  },
}))

/** Пользователь в том объёме, в каком его объявляет supabase-js. */
const signedUpUser = {
  id: 'user-1',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'Jane Doe' },
  created_at: '2026-09-06T00:00:00.000Z',
}

const renderIn = async (language: Language, page: React.ReactElement) => {
  await i18n.changeLanguage(language)
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{page}</MemoryRouter>
    </I18nextProvider>,
  )
}

/** Языки проекта. Объявление типом, а не приведением: `Object.keys(TEXTS)`
 *  вернул бы string[], и пришлось бы писать `as Language[]`. */
const LANGUAGES: Language[] = ['fr', 'en', 'nl']

/** Подписи полей и кнопок — точными строками каждого из трёх словарей. */
const TEXTS = {
  fr: {
    fullName: 'Nom complet',
    email: 'Email',
    passwordMin: 'Mot de passe (min. 8 caractères)',
    password: 'Mot de passe',
    createAccount: 'Créer un compte',
    logIn: 'Se connecter',
    checkInbox: 'Vérifiez votre boîte mail et confirmez votre adresse e-mail pour continuer.',
    emailNotConfirmed: 'Vérifiez votre boîte mail et confirmez votre adresse e-mail avant de vous connecter.',
  },
  en: {
    fullName: 'Full name',
    email: 'Email',
    passwordMin: 'Password (min. 8 characters)',
    password: 'Password',
    createAccount: 'Create account',
    logIn: 'Log in',
    checkInbox: 'Check your inbox and confirm your email to continue.',
    emailNotConfirmed: 'Please check your inbox and confirm your email before signing in.',
  },
  nl: {
    fullName: 'Volledige naam',
    email: 'E-mailadres',
    passwordMin: 'Wachtwoord (min. 8 tekens)',
    password: 'Wachtwoord',
    createAccount: 'Maak een account aan',
    logIn: 'Inloggen',
    checkInbox: 'Controleer uw inbox en bevestig uw e-mailadres om door te gaan.',
    emailNotConfirmed: 'Controleer uw inbox en bevestig uw e-mailadres voordat u inlogt.',
  },
} as const satisfies Record<Language, Record<string, string>>

describe('Формы входа и регистрации', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockReset()
    searchParamsMock.value = new URLSearchParams()
    dbMocks.maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it('новая регистрация уходит на страницу входа и просит подтвердить почту', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: signedUpUser, session: null },
      error: null,
    })
    dbMocks.maybeSingle.mockResolvedValue({ data: { id: 'referrer-1' }, error: null })
    searchParamsMock.value = new URLSearchParams('ref=ABC123')

    await renderIn('fr', <Register />)

    fireEvent.change(screen.getByLabelText(TEXTS.fr.fullName), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(TEXTS.fr.email), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText(TEXTS.fr.passwordMin), { target: { value: 'supersecret' } })
    fireEvent.click(screen.getByRole('button', { name: TEXTS.fr.createAccount }))

    await waitFor(() => {
      expect(dbMocks.from).toHaveBeenCalledWith('users')
      // Код из ссылки уходит в запрос ЗАГЛАВНЫМ: в базе referral_code лежит
      // так, а человек копирует ссылку как придётся.
      expect(dbMocks.eq).toHaveBeenCalledWith('referral_code', 'ABC123')
      expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
        email: 'jane@example.com',
        options: expect.objectContaining({
          data: expect.objectContaining({
            full_name: 'Jane Doe',
            referred_by: 'referrer-1',
          }),
        }),
      }))
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
    })

    // Точная строка, а не «похоже на подтверждение почты»: у сообщения
    // страницы входа то же начало, и прежний матчер /vérifiez|controleer/
    // принял бы его за успех регистрации.
    expect(screen.getByText(TEXTS.fr.checkInbox)).toBeInTheDocument()
  })

  it('без кода приглашения referred_by в метаданные не попадает', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: signedUpUser, session: null },
      error: null,
    })

    await renderIn('fr', <Register />)

    fireEvent.change(screen.getByLabelText(TEXTS.fr.fullName), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(TEXTS.fr.email), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText(TEXTS.fr.passwordMin), { target: { value: 'supersecret' } })
    fireEvent.click(screen.getByRole('button', { name: TEXTS.fr.createAccount }))

    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled())

    const sent = vi.mocked(supabase.auth.signUp).mock.calls[0][0]
    expect(sent.options?.data).not.toHaveProperty('referred_by')
    // Запроса за реферером без кода нет вовсе.
    expect(dbMocks.from).not.toHaveBeenCalled()
  })

  it('вход с неподтверждённой почтой объясняет причину, а не печатает отказ supabase', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthError('Email not confirmed'),
    })

    await renderIn('fr', <Login />)

    fireEvent.change(screen.getByLabelText(TEXTS.fr.email), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText(TEXTS.fr.password), { target: { value: 'supersecret' } })
    fireEvent.click(screen.getByRole('button', { name: TEXTS.fr.logIn }))

    await waitFor(() => expect(screen.getByText(TEXTS.fr.emailNotConfirmed)).toBeInTheDocument())
    // И на страницу не пускает: переход случается только при успехе.
    expect(navigateMock).not.toHaveBeenCalled()
  })

  // Обвязка действительно управляет языком: если словари перепутаются или
  // i18next уйдёт в fallback, эти три проверки разъедутся.
  describe.each<Language>(LANGUAGES)('язык %s', (language) => {
    it('форма регистрации говорит на нём, а не на соседнем', async () => {
      await renderIn(language, <Register />)

      expect(screen.getByLabelText(TEXTS[language].passwordMin)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: TEXTS[language].createAccount })).toBeInTheDocument()

      for (const other of LANGUAGES) {
        if (other === language) continue
        expect(screen.queryByLabelText(TEXTS[other].passwordMin)).not.toBeInTheDocument()
      }
    })
  })
})
