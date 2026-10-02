import { Component, type ReactNode } from 'react'
import { logError } from '../../lib/errorLog'

/**
 * Перехватчик ошибок маршрута — и лечение самой частой из них.
 *
 * Найдено 12.08 по жалобе «стоит и висит на логин, вообще другие
 * несуществующие страницы показывает». Искали снаружи — в сети, в кэше
 * Vercel, в расширениях браузера, — а причина была в коде:
 *
 *   16 маршрутов через lazy()
 *   <Suspense fallback={null}>   пока чанк грузится — пусто
 *   перехватчика ошибок нет      если чанк не загрузился — пусто НАВСЕГДА
 *
 * Механика поломки. Vite даёт файлам имена с хешем: Login-B7v_NMCH.js.
 * После каждой сборки хеш другой, старого файла на сервере больше нет.
 * У человека в браузере остаётся открытая вкладка со СТАРЫМ index.html;
 * он нажимает «Se connecter», приложение идёт за старым чанком и
 * получает 404. Динамический импорт отклоняется, ловить его некому,
 * React снимает поддерево — пустой экран. Со стороны это неотличимо от
 * «сайт завис».
 *
 * 12.08 деплоев было около восьми за день, и каждый обесценивал вкладки,
 * открытые до него.
 *
 * Лечение здесь ровно одно и оно верное: перезагрузить страницу. Свежий
 * index.html назовёт правильные имена файлов. Перезагружаем ОДИН раз —
 * отметка времени в sessionStorage не даёт зациклиться, если дело не в чанке, а в
 * настоящей ошибке; тогда человек увидит текст и кнопку, а не пустоту.
 */

const RELOADED = 'rentit_chunk_reload'

/**
 * Не чаще раза в минуту. Флаг хранит ВРЕМЯ последней автоматической
 * перезагрузки, а не «было/не было».
 *
 * До 02.10 флаг снимала оболочка приложения при монтировании (AppChrome),
 * чтобы следующий сбой в той же сессии получил свою попытку. Без сети это
 * давало петлю: кусок страницы не грузится → перезагрузка → оболочка из
 * кэша воркера снимает флаг → кусок снова не грузится → перезагрузка — и
 * так без конца, быстрее, чем человек успевает уйти. Время закрывает обе
 * задачи: повтор через минуту законен (новый выкат), повтор сразу — нет.
 */
const RELOAD_WINDOW_MS = 60_000

// sessionStorage бывает запрещён настройкой браузера и тогда БРОСАЕТ. Здесь
// это последняя преграда перед белым экраном — ронять её нельзя.
// undefined — хранилище недоступно (не путать с null — «отметки нет»).
const readReloadedAt = (): string | null | undefined => {
  try { return sessionStorage.getItem(RELOADED) } catch { return undefined }
}
const markReloaded = () => {
  try { sessionStorage.setItem(RELOADED, String(Date.now())) } catch { /* без памяти — без отметки */ }
}
const clearReloaded = () => {
  try { sessionStorage.removeItem(RELOADED) } catch { /* см. выше */ }
}

/**
 * Перезагружались ли только что. Непонятное значение — считаем, что да.
 * Хранилище недоступно — тоже да: без памяти о прошлой перезагрузке
 * автоматическая пошла бы по кругу. Человек получает текст и кнопку.
 */
const reloadedRecently = (now = Date.now()): boolean => {
  const raw = readReloadedAt()
  if (raw === undefined) return true
  if (raw === null) return false
  const at = Number(raw)
  // Не похоже на время (старое значение «1») — считаем, что перезагружались.
  const isTimestamp = at > 1e12
  if (!isTimestamp) return true
  return now - at < RELOAD_WINDOW_MS
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Сообщения браузеров при непогрузившемся модуле. Chrome и Edge говорят
// одно, Firefox другое, Safari третье — поэтому список, а не одна строка.
const looksLikeChunkFailure = (err: unknown) => {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg)
}

type Props = {
  children: ReactNode
  message: string
  retry: string
  /** Текст, когда кусок страницы не загрузился без сети: перезагрузка тут не поможет. */
  offlineMessage: string
}
type State = { failed: boolean; offline: boolean }

export default class RouteBoundary extends Component<Props, State> {
  state: State = { failed: false, offline: false }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    const chunk = looksLikeChunkFailure(error)

    // Без сети кусок, которого нет в кэше, не загрузит никакая перезагрузка.
    // Честный текст вместо петли; это не поломка продукта — в журнал не идёт.
    if (chunk && isOffline()) {
      console.error('RouteBoundary (hors ligne):', error)
      this.setState({ offline: true })
      return
    }

    const firstChunkFailure = chunk && !reloadedRecently()

    // В журнал и на сервер — всё, КРОМЕ первого непогрузившегося чанка: он
    // ожидаем после каждого выката и лечится перезагрузкой ниже. Если и
    // после неё не грузится — это уже настоящая поломка, и она уходит.
    //
    // До 23.09 здесь стоял только console.error: падения СТРАНИЦ — а их
    // большинство — не попадали ни в журнал «скопировать подробности», ни
    // куда-либо ещё.
    if (firstChunkFailure) console.error('RouteBoundary:', error)
    else logError('render', error)

    if (firstChunkFailure) {
      // Отмечаем ДО перезагрузки: если новая версия тоже упадёт в течение
      // минуты, второй раз не перезагружаемся, а показываем текст.
      markReloaded()
      window.location.reload()
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="page" role="alert" style={{ textAlign: 'center', paddingTop: 'var(--space-8)' }}>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--muted)', marginBottom: 'var(--space-5)' }}>
          {this.state.offline ? this.props.offlineMessage : this.props.message}
        </p>
        <button
          className="btn btn-primary"
          style={{ minHeight: '48px' }}
          onClick={() => { clearReloaded(); window.location.reload() }}
        >
          {this.props.retry}
        </button>
      </div>
    )
  }
}
