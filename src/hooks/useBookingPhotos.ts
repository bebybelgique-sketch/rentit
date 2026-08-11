// src/hooks/useBookingPhotos.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const BOOKING_PHOTOS_BUCKET = 'booking-photos';

// Час: ссылка должна пережить просмотр страницы, но не осесть в чужой
// истории браузера навсегда.
const SIGNED_URL_TTL_SECONDS = 3600;

export type BookingPhotoPhase = 'handover' | 'return';

export interface BookingPhoto {
  id: string;
  booking_id: string;
  uploaded_by: string;
  phase: BookingPhotoPhase;
  storage_path: string;
  created_at: string;
  url: string;
}

// В базе лежит путь, а не URL. Бакет приватный намеренно: публичная ссылка на
// фотографию чужой вещи в чужой квартире живёт вечно и расходится по индексам,
// даже когда бронь давно закрыта. Ссылку выдаём подписанную и на время.
const fetchBookingPhotos = async (bookingId: string | undefined): Promise<BookingPhoto[]> => {
  if (!bookingId) return [];

  const { data, error } = await supabase
    .from('booking_photos')
    .select('id, booking_id, uploaded_by, phase, storage_path, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const paths = data.map((row) => row.storage_path);
  const { data: signed, error: signErr } = await supabase.storage
    .from(BOOKING_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (signErr) throw signErr;

  const urlByPath = new Map<string, string>();
  for (const entry of signed || []) {
    if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
  }

  // Фотография без действительной ссылки не показывается: пустой <img>
  // выглядит как «фото не сделали», а это противоположно правде.
  return data
    .map((row) => ({
      id: row.id,
      booking_id: row.booking_id,
      uploaded_by: row.uploaded_by,
      phase: row.phase as BookingPhotoPhase,
      storage_path: row.storage_path,
      created_at: row.created_at,
      url: urlByPath.get(row.storage_path) || '',
    }))
    .filter((photo) => photo.url !== '');
};

export const useBookingPhotos = (bookingId: string | undefined) => {
  return useQuery<BookingPhoto[], Error>({
    queryKey: ['bookingPhotos', bookingId],
    queryFn: () => fetchBookingPhotos(bookingId),
    enabled: !!bookingId,
    // Меньше срока жизни подписи, иначе из кеша придёт протухшая ссылка.
    staleTime: (SIGNED_URL_TTL_SECONDS - 300) * 1000,
  });
};
