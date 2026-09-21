import { Component, type ReactNode } from 'react'
import { logError, formatErrorLog, clearErrorLog } from '../../lib/errorLog'

/**
 * Последняя преграда между поломкой и белым экраном.
 *
 * ── ПОЧЕМУ МАЛО RouteBoundary ────────────────────────────────────────
 *
 * Тот перехватчик обёрнут вокруг `<Routes>` и ловит падения СТРАНИЦ. А
 * навигация, нижняя панель, окно согласия и полоса «нет сети» стоят
 * СНАРУЖИ него. Падение в любом из них React обрабатывает единственным
 * доступным ему способом: снимает всё дерево. Человек получает пустую
 * страницу и ни одного слова о том, что случилось.
 *
 * Это не гипотеза о будущем, а устройство: достаточно посмотреть, где в
 * App.tsx стоит `<Navbar>` относительно `<RouteBoundary>`.
 *
 * ── ЧЕМ ЭТОТ ЭКРАН ОТЛИЧАЕТСЯ ОТ «ЧТО-ТО ПОШЛО НЕ ТАК» ───────────────
 *
 * Тем, что с него можно уйти и что с него можно ПРИСЛАТЬ. Кнопка
 * «скопировать подробности» кладёт в буфер журнал последних поломок
 * (src/lib/errorLog.ts) — без единого личного поля. Сегодня единственный
 * след поломки это строка в консоли, которую никто никогда не откроет, и
 * разговор начинается со слов «у меня не работает».
 *
 * ── ПОЧЕМУ БЕЗ ПЕРЕВОДА ──────────────────────────────────────────────
 *
 * Подписи приходят пропсами из App, где есть `t`. Звать словарь ВНУТРИ
 * перехватчика нельзя: если приложение упало на инициализации i18n, то
 * экран поломки упадёт следом, и человек снова окажется перед пустотой.
 * Запасной экран обязан работать, когда не работает ничего.
 */

interface Props {
  children: ReactNode
  title: string
  text: string
  retry: string
  copy: string
  copied: string
}

interface State {
  failed: boolean
  copied: boolean
}

export default class AppBoundary extends Component<Props, State> {
  state: State = { failed: false, copied: false }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    logError('render', error)
  }

  private copyDetails = async () => {
    const text = formatErrorLog()
    try {
      await navigator.clipboard.writeText(text)
      this.setState({ copied: true })
    } catch {
      // Буфер обмена запрещён — не редкость на телефоне и в iframe.
      // Молчать нельзя: человек нажал и ждёт. Показываем текст, чтобы
      // он мог выделить его руками.
      // eslint-disable-next-line no-alert
      window.prompt(this.props.copy, text)
    }
  }

  private restart = () => {
    // Журнал больше не нужен: он уже либо скопирован, либо не понадобился.
    // Оставлять его значит показывать вчерашнюю ошибку к завтрашней жалобе.
    clearErrorLog()
    window.location.href = '/'
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div
        // Свои стили, без классов продукта: падение могло произойти и
        // из-за них.
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '32px 20px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#F1F3F5',
          color: '#16181C',
        }}
        role="alert"
      >
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          {this.props.title}
        </h1>
        <p style={{ maxWidth: '38ch', color: '#52585F', margin: 0, lineHeight: 1.5 }}>
          {this.props.text}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.restart}
            style={{
              minHeight: '44px', padding: '0 20px', border: 'none', borderRadius: '6px',
              background: '#C8102E', color: '#FFFFFF', fontWeight: 700, fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            {this.props.retry}
          </button>
          <button
            onClick={this.copyDetails}
            style={{
              minHeight: '44px', padding: '0 20px', borderRadius: '6px',
              border: '1px solid #CFD4DA', background: 'transparent',
              color: '#16181C', fontWeight: 600, fontSize: '15px', cursor: 'pointer',
            }}
          >
            {this.state.copied ? this.props.copied : this.props.copy}
          </button>
        </div>
      </div>
    )
  }
}
