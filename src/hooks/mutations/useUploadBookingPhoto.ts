// src/hooks/mutations/useUploadBookingPhoto.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabase';
import { BOOKING_PHOTOS_BUCKET, type BookingPhotoPhase } from '../useBookingPhotos';

interface UploadBookingPhotoParams {
  bookingId: string;
  uploadedBy: string;
  phase: BookingPhotoPhase;
  file: File;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 10 * 1024 * 1024;

const uploadBookingPhoto = async ({
  bookingId,
  uploadedBy,
  phase,
  file,
}: UploadBookingPhotoParams): Promise<string> => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Format non accepté : JPEG, PNG, WebP ou HEIC');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Photo trop lourde : 10 Mo maximum');
  }

  // Первый сегмент пути — идентификатор брони. Это не украшение: политика
  // на storage.objects читает именно его, чтобы решить, чей это файл.
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${bookingId}/${phase}/${unique}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BOOKING_PHOTOS_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from('booking_photos')
    .insert([{
      booking_id: bookingId,
      uploaded_by: uploadedBy,
      phase,
      storage_path: storagePath,
    }]);

  // Файл без записи никому не виден и не удаляется вместе с бронью — это
  // мусор в приватном бакете, за который никто не отвечает. Убираем сразу.
  if (insertError) {
    await supabase.storage.from(BOOKING_PHOTOS_BUCKET).remove([storagePath]);
    throw insertError;
  }

  return storagePath;
};

export const useUploadBookingPhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadBookingPhoto,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.photos(variables.bookingId) });
    },
  });
};
