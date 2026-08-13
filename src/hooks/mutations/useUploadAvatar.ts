// src/hooks/mutations/useUploadAvatar.ts
//
// Загрузка аватара файлом.
//
// До 13.08 аватар задавался ВСТАВКОЙ ССЫЛКИ: в профиле стояло текстовое
// поле `avatar_url`, и человек должен был сам где-то разместить фотографию.
// Бакет `avatars` и политики на запись существовали с самого начала — трубу
// проложили, форму не сделали. Сосед из Брабант-Валлона, у которого нет
// своего хостинга, аватар поставить не мог, а `/list-item` его просит.

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AVATARS_BUCKET,
  AVATAR_EXTENSIONS,
  avatarObjectName,
  avatarExtension,
} from '../../lib/avatars';

/** Больше — не фотография профиля, а чей-то оригинал с зеркалки. */
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadAvatarResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'type' | 'size' | 'upload'; message: string };

export function useUploadAvatar() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, userId: string): Promise<UploadAvatarResult> => {
    const ext = avatarExtension(file.name);
    if (!ext) {
      return {
        ok: false,
        reason: 'type',
        message: `Format non accepté. Choisissez une image ${AVATAR_EXTENSIONS.join(', ')}.`,
      };
    }
    if (file.size > MAX_BYTES) {
      return {
        ok: false,
        reason: 'size',
        message: `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 5 Mo.`,
      };
    }

    setUploading(true);
    try {
      const name = avatarObjectName(userId, ext);

      // СНАЧАЛА УБРАТЬ СВОИ, ПОТОМ ПОЛОЖИТЬ НОВЫЙ. Порядок вынужденный и
      // проверен на живом хранилище 13.08:
      //   upload без upsert  → ok
      //   upload с upsert    → 403 «new row violates row-level security policy»
      // Путь upsert идёт через UPDATE и на здешних политиках не проходит. А
      // уникальное имя не подобрать: политика требует ровно
      // `<uid>.<расширение>` (`split_part(name, '.', 1) = auth.uid()`).
      //
      // Заодно это единственный способ убрать прежний снимок с ДРУГИМ
      // расширением: `<uid>.png` и `<uid>.jpg` — разные объекты, и новая
      // загрузка старый не трогает. Оставить его — значит оставить снятую
      // фотографию лица в ПУБЛИЧНОМ бакете.
      const mine = AVATAR_EXTENSIONS.map(e => avatarObjectName(userId, e));
      const { error: rmErr } = await supabase.storage.from(AVATARS_BUCKET).remove(mine);
      // Промах уборки не должен валить замену: не удалённое подберёт
      // `cleanup-orphan-photos`, а человеку важна новая фотография.
      if (rmErr) console.error('Не удалось убрать прежний аватар:', rmErr.message);

      const { error: upErr } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(name, file, { contentType: file.type || undefined });
      if (upErr) return { ok: false, reason: 'upload', message: upErr.message };

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(name);

      // Метка времени, чтобы браузер показал НОВУЮ фотографию: адрес не
      // менялся, и без неё человек видел бы старую до сброса кэша и решил,
      // что загрузка не сработала.
      return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
