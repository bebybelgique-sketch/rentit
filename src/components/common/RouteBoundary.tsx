import { Component, type ReactNode } from 'react'

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
 * флаг в sessionStorage не даёт зациклиться, если дело не в чанке, а в
 * настоящей ошибке; тогда человек увидит текст и кнопку, а не пустоту.
 */

const RELOADED = 'rentit_chunk_reload'

// Сообщения браузеров при непогрузившемся модуле. Chrome и Edge говорят
// одно, Firefox другое, Safari третье — поэтому список, а не одна строка.
const looksLikeChunkFailure = (err: unknown) => {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg)
}

type Props = { children: ReactNode; message: string; retry: string }
type State = { failed: boolean }

export default class RouteBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('RouteBoundary:', error)

    if (looksLikeChunkFailure(error) && !sessionStorage.getItem(RELOADED)) {
      // Отмечаем ДО перезагрузки: если новая версия тоже упадёт, второй
      // раз не перезагружаемся, а показываем текст. Бесконечная
      // перезагрузка хуже честной ошибки — из неё человек не выйдет.
      sessionStorage.setItem(RELOADED, '1')
      window.location.reload()
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 'var(--space-8)' }}>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--muted)', marginBottom: 'var(--space-5)' }}>
          {this.props.message}
        </p>
        <button
          className="btn btn-primary"
          style={{ minHeight: '48px' }}
          onClick={() => { sessionStorage.removeItem(RELOADED); window.location.reload() }}
        >
          {this.props.retry}
        </button>
      </div>
    )
  }
}

/** Успешная загрузка снимает флаг: следующая поломка снова получит попытку. */
export const clearChunkReloadFlag = () => sessionStorage.removeItem(RELOADED)
