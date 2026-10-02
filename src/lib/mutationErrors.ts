import { MutationCache } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import i18n from '../i18n-next'

/**
 * Кто сообщает человеку, что действие не удалось.
 *
 * До 03.10 общий тост «Une erreur est survenue» висел на всех мутациях
 * сразу и срабатывал поверх точной причины на месте: владелец одобряет
 * заявку на занятые даты — тост «Ces dates ne sont plus disponibles» и
 * рядом второй, «Une erreur est survenue. Veuillez réessayer plus tard».
 * Два сообщения об одной ошибке, и общее советует повторить то, что
 * повтором не исправить.
 *
 * Теперь мутация говорит сама, кто сообщает:
 *  - 'caller' — каждое место вызова показывает причину (поле формы, тост
 *    с текстом из serverErrors). Общий тост молчит;
 *  - 'nobody' — сбой не событие для человека (отметка «прочитано»:
 *    следующая попытка сделает то же самое);
 *  - не указано — общий тост. Мутация, о сбое которой забыли сообщить,
 *    не проваливается молча: лишнее сообщение заметно, немая ошибка — нет.
 *
 * Тексту общего тоста — словарь, а не error.message: сообщение приходит от
 * Supabase по-английски («permission denied for table users» поверх
 * французской страницы — так выглядел блокер 11.08).
 */
export type ErrorShownBy = 'caller' | 'nobody'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      errorShownBy?: ErrorShownBy
    }
  }
}

export function reportMutationError(error: unknown, shownBy: ErrorShownBy | undefined): void {
  console.error(error)
  if (shownBy) return
  toast.error(i18n.t('errors.generic'))
}

export const createMutationCache = () =>
  new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) =>
      reportMutationError(error, mutation.meta?.errorShownBy),
  })
