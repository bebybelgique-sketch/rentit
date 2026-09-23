// src/hooks/useUploadImage.ts
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ITEM_PHOTOS_BUCKET } from '../lib/itemPhotos';
import i18n from '../i18n-next';

// Хук возвращает кортеж (см. сигнатуру ниже), поэтому отдельный интерфейс
// UploadImageResult, который тут был, ничего не описывал и удалён.

export const useUploadImage = (): [(file: File, folder: string) => Promise<string>, boolean, string | null] => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (file: File, folder: string): Promise<string> => {
    setUploading(true);
    setError(null);

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    const fileName = `${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Бакета `item-images` не существует — проверено запросом к живой базе
    // 13.08: в проекте три бакета, `avatars`, `booking-photos` и
    // `item-photos`. Загрузка отсюда падала с «Bucket not found» на каждой
    // попытке заменить снимок объявления.
    const { error: uploadError } = await supabase.storage
      .from(ITEM_PHOTOS_BUCKET)
      .upload(filePath, file, { upsert: true }); // upsert позволяет перезаписать файл с тем же именем

    if (uploadError) {
      // Экран показывает это как есть — значит, текст наш и на языке человека.
      console.error('[upload] снимок вещи:', uploadError.message);
      setError(i18n.t('editItem.photoUploadFailed'));
      setUploading(false);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(ITEM_PHOTOS_BUCKET)
      .getPublicUrl(filePath);

    setUploading(false);
    return data.publicUrl;
  };

  return [uploadImage, uploading, error];
};