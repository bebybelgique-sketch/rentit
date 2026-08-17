// src/hooks/useItemById.ts
import { useQuery } from '@tanstack/react-query';
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

  // Преобразование данных из Supabase к типу Item.
  //
  // Четыре нижних поля здесь не переносились, хотя в типе `Item` объявлены.
  // Единственный потребитель хука — форма редактирования, и она читала
  // ровно их: подставляла пустую категорию и пустое состояние поверх
  // заполненных, обнуляла залог и не видела остальных снимков объявления.
  const mappedItem: Item = {
    id: data.id,
    title: data.title,
    description: data.description,
    price_per_day: data.price_per_day,
    image_url: Array.isArray(data.photos) && data.photos.length > 0 ? data.photos[0] : '',
    owner_id: data.owner_id,
    location: data.address,
    latitude: data.lat,
    longitude: data.lng,
    is_available: data.available,
    created_at: data.created_at,
    deposit: data.deposit ?? 0,
    category: data.category ?? '',
    condition: data.condition ?? '',
    photos: Array.isArray(data.photos) ? data.photos : [],
    // Пустое значение оставляем пустым, а не приводим к нулю: ноль здесь
    // означал бы «неделя бесплатно», и расчёт принял бы его всерьёз.
    price_3days: data.price_3days ?? null,
    price_week: data.price_week ?? null,
    late_fee_per_day: data.late_fee_per_day ?? null,
    // Умолчания те же, что у колонок в базе: старое объявление, прочитанное
    // до применения миграции, не должно превратиться в «ноль единиц».
    quantity: data.quantity ?? 1,
    buffer_days: data.buffer_days ?? 0,
    min_notice_days: data.min_notice_days ?? 0,
  };

  return mappedItem;
};

// Экспортируем хук, используя useQuery
export const useItemById = (id: string | undefined) => {
  return useQuery<Item | null, Error>({
    queryKey: ['item', id],
    queryFn: () => fetchItemById(id!),
    enabled: !!id, // Запрос выполняется только если id существует
    staleTime: 30000, // Данные считаются актуальными 30 секунд
  });
};