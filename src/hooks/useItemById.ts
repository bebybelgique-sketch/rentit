// src/hooks/useItemById.ts
import { useQuery } from '@tanstack/react-query';
import { itemKeys } from '../lib/queryKeys';
import { supabase } from '../lib/supabase';
import { Item } from '../types';

// Определяем функцию для получения данных
const fetchItemById = async (id: string): Promise<Item | null> => {
  if (!id) return null;

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Код ошибки "Row not found"
      return null;
    }
    throw error;
  }

  // Строка возвращается как есть. Здесь стоял маппер: он переписывал
  // имена колонок (lat → latitude), подставлял умолчания вместо NULL и
  // переносил не все поля — форма редактирования получала пустую категорию
  // и нулевой залог поверх сохранённых (PR #19). Ни одна из трёх работ
  // маппера не нужна: имена в типе теперь совпадают с колонками, снимки
  // читает photosOf по месту показа, а умолчания подставляет форма — там,
  // где известно, что значит пустое поле в конкретном поле ввода.
  return data ?? null;
};

// Экспортируем хук, используя useQuery
export const useItemById = (id: string | undefined) => {
  return useQuery<Item | null, Error>({
    queryKey: itemKeys.one(id),
    queryFn: () => fetchItemById(id!),
    enabled: !!id, // Запрос выполняется только если id существует
    staleTime: 30000, // Данные считаются актуальными 30 секунд
  });
};