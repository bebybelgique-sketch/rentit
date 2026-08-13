// supabase/functions/_shared/sweep.ts
//
// Поиск осиротевших файлов в бакете. Вынесено из `cleanup-orphan-photos`
// отдельным модулем по одной причине: это единственный код в проекте,
// который УДАЛЯЕТ чужие файлы, и проверять его выкаткой в прод нельзя.
// Здесь нет ни Deno, ни сети — только обход и решение «сирота или нет»,
// поэтому модуль запускается обычным vitest (`__tests__/sweep.test.ts`).
//
// Сам вызов Storage остаётся в функции: сюда передают `list`, отсюда
// возвращают список путей на удаление. Решение и исполнение разделены
// намеренно — так тест может утверждать, что именно будет снесено, не
// снеся ничего.

export interface StorageEntry {
  name: string
  created_at?: string | null
}

export interface SweepPlan {
  /** Сколько путей удерживается ссылками из базы. */
  checked: number
  /** Сколько файлов увидели в бакете. */
  scanned: number
  /** Что удалять. */
  orphans: string[]
}

export interface SweepOptions {
  /** Читает содержимое папки. Папки и файлы приходят одним списком. */
  list: (prefix: string) => Promise<StorageEntry[]>
  /** Пути, на которые ссылается база: всё остальное — сироты. */
  known: Set<string>
  /** С какой папки начинать: '' для booking-photos, 'items' для item-photos. */
  root: string
  /**
   * Сколько уровней папок лежит МЕЖДУ корнем и файлами.
   *
   * Оба бакета хранят пути из трёх сегментов, но у одного первый сегмент
   * фиксирован, и это меняет глубину обхода:
   *   booking-photos, корень '':      <booking>/<phase>/<файл> → 2
   *   item-photos,    корень 'items': items/<uid>/<файл>       → 1
   *
   * Первая редакция считала оба бакета одинаковыми и уходила на шаг глубже:
   * файлы `item-photos` не находились НИКОГДА, а уборка при этом отвечала
   * «удалено 0» — то есть выглядела работающей.
   */
  depth: number
  /**
   * Выдержка. Между загрузкой файла и появлением ссылки на него в базе
   * проходит доля секунды, и уборка, запущенная ровно в этот момент, снесла
   * бы снимок у человека из-под рук.
   */
  minAgeMs: number
  /** Только для тестов: подменяемое «сейчас». */
  now?: number
}

/**
 * Обходит бакет от `root` вглубь на `depth` уровней папок и решает по каждому
 * файлу, сирота он или нет.
 */
export async function planSweep(opts: SweepOptions): Promise<SweepPlan> {
  const { list, known, root, depth, minAgeMs } = opts
  const now = opts.now ?? Date.now()

  const orphans: string[] = []
  let scanned = 0

  const walk = async (prefix: string, left: number): Promise<void> => {
    const entries = await list(prefix)

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name

      if (left > 0) {
        await walk(path, left - 1)
        continue
      }

      scanned++
      if (known.has(path)) continue

      // Файл без даты создания не трогаем: без неё выдержку не проверить,
      // а ошибиться здесь — значит удалить живой снимок.
      const created = entry.created_at ? Date.parse(entry.created_at) : NaN
      if (!Number.isFinite(created)) continue
      if (now - created < minAgeMs) continue

      orphans.push(path)
    }
  }

  await walk(root, depth)

  return { checked: known.size, scanned, orphans }
}
