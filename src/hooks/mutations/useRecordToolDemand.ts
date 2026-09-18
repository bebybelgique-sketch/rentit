// src/hooks/mutations/useRecordToolDemand.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface RecordToolDemandParams {
  /** Что человек назвал. Обязательно: запись без инструмента ничего не измеряет. */
  tool: string;
  /**
   * Строка, которая была в поиске в момент вопроса. Может отличаться от
   * `tool`: подставленное значение дают исправить. Расхождение этих двух
   * полей само по себе сведение — оно показывает, что поиск понял не то.
   */
  searchedQuery?: string;
  /** Язык интерфейса: спрос на фламандском и на французском засевается в разных местах. */
  locale?: string;
}

/**
 * Записать названный спрос с пустой витрины.
 *
 * ЗАЧЕМ ЭТО ВООБЩЕ ЕСТЬ. Замер прода 17.09.2026: вещей ноль, `browse_items`
 * возвращает [] при любых фильтрах. На витрине без предложения это
 * единственный прибор, отвечающий на вопрос «что засевать первым» — и он
 * дешевле любого опроса: человек уже здесь и уже искал.
 *
 * ПОЧЕМУ БЕЗ `.select()`. Таблица пишущая, но не читающая: у клиента есть
 * только INSERT (миграции 34 и 36), список спроса читает service_role.
 * PostgREST с `return=minimal` права на чтение не требует, а добавленный
 * когда-нибудь `.select()` вернёт 42501 — это закреплено тестом.
 *
 * ПОЧЕМУ НЕТ ПОЧТЫ. Адрес просят, чтобы написать, когда инструмент появится.
 * Канал письма в продукте не подтверждён (RESEND_API_KEY), а собирать
 * персональные данные под обещание, которое может не исполниться, нельзя ни
 * по GDPR.md, ни по правилу не обещать канал. Имя инструмента — и есть
 * сигнал; адрес приедет тем же PR, что и работающее письмо.
 */
const recordToolDemand = async ({ tool, searchedQuery, locale }: RecordToolDemandParams): Promise<void> => {
  const { error } = await supabase.from('tool_demands').insert({
    tool: tool.trim(),
    // Пустая строка и пробелы — не «искал пустоту», а «ничего не искал»:
    // в таком случае колонка остаётся NULL, а не хранит видимость данных.
    searched_query: searchedQuery?.trim() || null,
    locale: locale ?? null,
  });

  if (error) throw new Error(error.message);
};

export const useRecordToolDemand = () => useMutation({ mutationFn: recordToolDemand });
