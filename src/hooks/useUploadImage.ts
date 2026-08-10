// src/hooks/useUploadImage.ts
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface UploadImageResult {
  url: string | null;
  error: string | null;
  uploading: boolean;
}

export const useUploadImage = (): [(file: File, folder: string) => Promise<string>, boolean, string | null] => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (file: File, folder: string): Promise<string> => {
    setUploading(true);
    setError(null);

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    const fileName = `${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('item-images') // Предполагаем, что у вас есть bucket 'item-images'
      .upload(filePath, file, { upsert: true }); // upsert позволяет перезаписать файл с тем же именем

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('item-images')
      .getPublicUrl(filePath);

    setUploading(false);
    return data.publicUrl;
  };

  return [uploadImage, uploading, error];
};