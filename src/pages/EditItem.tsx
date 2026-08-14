// src/pages/EditItem.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useItemById } from '../hooks/useItemById';
import { useUpdateItem, type ItemUpdate } from '../hooks/mutations/useUpdateItem';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, CONDITIONS } from '../domain/catalog';
import { useUploadImage } from '../hooks/useUploadImage';
import { supabase } from '../lib/supabase';
import { ITEM_PHOTOS_BUCKET, itemPhotoPath } from '../lib/itemPhotos';

const EditItem: React.FC = () => {
  const { t } = useTranslation();
  const { id: itemId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: item, isLoading: itemLoading, error: itemError } = useItemById(itemId);
  const updateItemMutation = useUpdateItem();
  const [uploadImage, uploading, uploadError] = useUploadImage();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price_per_day: 0,
    // Пустые тарифы держим строками: число не умеет отличить «не назначен»
    // от нуля, а ноль здесь означал бы «неделя бесплатно».
    price_3days: '' as string,
    price_week: '' as string,
    late_fee_per_day: '' as string,
    deposit: 0,
    category: '',
    condition: '',
    address: '',
    lat: null as number | null,
    lng: null as number | null,
    available: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        description: item.description || '',
        price_per_day: item.price_per_day,
        // `?? ''` намеренно вместо `|| ''`: тариф в 0 база не допустит, но
        // приводить пустое к строке надо ровно там, где оно пустое.
        price_3days: item.price_3days == null ? '' : String(item.price_3days),
        price_week: item.price_week == null ? '' : String(item.price_week),
        late_fee_per_day: item.late_fee_per_day == null ? '' : String(item.late_fee_per_day),
        deposit: item.deposit || 0,
        category: item.category || '', // Assuming category is part of the Item type
        condition: item.condition || '', // Assuming condition is part of the Item type
        address: item.location || '', // Map location to address
        lat: item.latitude || null,
        lng: item.longitude || null,
        available: item.is_available,
      });
    }
  }, [item]);

  if (!user) {
    return (
      <div className="page">
        <div className="loading">{t('editItem.loginToEdit')}</div>
      </div>
    );
  }

  if (itemLoading) return <div className="page"><div className="loading">{t('editItem.loading')}</div></div>;
  if (itemError) return <div className="page"><div className="loading">Erreur: {itemError.message}</div></div>;
  if (!item) return <div className="page"><div className="loading">{t('editItem.notFound')}</div></div>;

  // Проверка, является ли пользователь владельцем
  if (item.owner_id !== user.id) {
    return (
      <div className="page">
        <div className="loading">{t('editItem.accessDenied')}</div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? parseFloat(value) : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Колонки `image_url` в таблице `items` нет — снимки лежат в `photos`.
      // PostgREST отклонял ВЕСЬ запрос целиком (PGRST204, замерено на живой
      // базе 13.08), поэтому страница не сохраняла ничего: ни цену, ни
      // описание, ни доступность. Человек видел «Une erreur s'est produite».
      // Тарифы держатся в форме строками, а в базе это numeric. Пустая
      // строка — «тарифа нет» и уходит как NULL; ноль база отклонит
      // проверкой, поэтому отвечаем человеку здесь, а не отказом Postgres.
      const tier = (raw: string, label: string): number | null => {
        if (raw.trim() === '') return null;
        const v = parseFloat(raw);
        if (!(v > 0)) throw new Error(`${label} ${t('listItem.priceMustBePositive').toLowerCase()}`);
        return v;
      };

      const { price_3days, price_week, late_fee_per_day, ...rest } = formData;
      const updates: ItemUpdate = {
        ...rest,
        price_3days: tier(price_3days, t('listItem.package3Days')),
        price_week: tier(price_week, t('listItem.packageWeek')),
        late_fee_per_day: tier(late_fee_per_day, t('listItem.lateFeesLabel')),
      };

      if (imageFile) {
        // Путь обязан быть `items/<uid>/…`: правило удаления в Storage
        // сверяет владельца со ВТОРЫМ сегментом пути. При прежнем `items/…`
        // файл нельзя было бы удалить даже собственнику.
        const newUrl = await uploadImage(imageFile, `items/${user.id}`);

        // Подпись у поля обещает заменить «l'actuelle» — текущий снимок,
        // то есть первый. Остальные снимки объявления остаются: прежний код
        // слал photos: [imageUrl] и на объявлении с тремя снимками молча
        // оставлял один.
        const previous = item.photos ?? [];
        updates.photos = [newUrl, ...previous.slice(1)];

        // Заменённый файл больше ничем не удерживается. Не удалить его
        // здесь — значит оставить снимок чужой вещи в публичном бакете
        // навсегда, вопреки обещанию политики конфиденциальности.
        const replaced = itemPhotoPath(previous[0]);
        if (replaced) {
          const { error: rmErr } = await supabase.storage
            .from(ITEM_PHOTOS_BUCKET)
            .remove([replaced]);
          // Уборка не должна валить сохранение: объявление важнее файла, а
          // недобитый файл подберёт cleanup-orphan-photos.
          if (rmErr) console.error('Не удалось удалить заменённый снимок:', rmErr.message);
        }
      }
      // Без нового файла `photos` не трогаем вовсе — иначе любое изменение
      // цены переписывало бы список снимков.

      await updateItemMutation.mutateAsync({
        id: itemId!,
        updates,
        userId: user.id,
      });
      // Перенаправить на страницу просмотра или список
      alert(t('editItem.updateSuccess'));
      navigate(`/item/${itemId}`);
    } catch (error) {
      console.error(t('editItem.updateError'), error);
      alert(t('editItem.updateErrorGeneric'));
    }
  };

  return (
    <div className="page">
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>{t('editItem.title')}</h1>

        {updateItemMutation.isError && <div className="error-msg">Erreur: {(updateItemMutation.error as Error).message}</div>}
        {uploadError && <div className="error-msg">Erreur d'upload: {uploadError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">{t('editItem.titleField')}</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">{t('form.description')}</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="price_per_day">{t('editItem.pricePerDay')}</label>
            <input
              id="price_per_day"
              name="price_per_day"
              type="number"
              value={formData.price_per_day}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="deposit">{t('editItem.deposit')}</label>
            <input
              id="deposit"
              name="deposit"
              type="number"
              value={formData.deposit}
              onChange={handleChange}
              min="0"
              step="0.01"
              style={{ width: '100%' }}
            />
          </div>

          {/* Тарифы на срок и просрочка. Свой обработчик, а не общий
              `handleChange`: тот приводит любое числовое поле через
              parseFloat, и пустая строка стала бы NaN — то есть «тариф не
              назначен» превратилось бы в мусор при первом же касании. */}
          <div className="form-group">
            <label htmlFor="price_3days">{t('editItem.package3Days')} <span style={{ color: 'var(--muted)', fontWeight: '400' }}>{t('common.optional')}</span></label>
            <input
              id="price_3days"
              name="price_3days"
              type="number"
              value={formData.price_3days}
              onChange={e => setFormData(prev => ({ ...prev, price_3days: e.target.value }))}
              min="0.50"
              step="0.50"
              placeholder={t('editItem.package3DaysHint')}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="price_week">{t('editItem.packageWeek')} <span style={{ color: 'var(--muted)', fontWeight: '400' }}>{t('common.optional')}</span></label>
            <input
              id="price_week"
              name="price_week"
              type="number"
              value={formData.price_week}
              onChange={e => setFormData(prev => ({ ...prev, price_week: e.target.value }))}
              min="0.50"
              step="0.50"
              placeholder={t('editItem.packageWeekHint')}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="late_fee_per_day">{t('editItem.lateFee')} <span style={{ color: 'var(--muted)', fontWeight: '400' }}>{t('common.optional')}</span></label>
            <input
              id="late_fee_per_day"
              name="late_fee_per_day"
              type="number"
              value={formData.late_fee_per_day}
              onChange={e => setFormData(prev => ({ ...prev, late_fee_per_day: e.target.value }))}
              min="0.50"
              step="0.50"
              placeholder="ex. 10.00"
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '5px', lineHeight: 1.5 }}>
              Montant annoncé à l'avance, réglé entre vous à la restitution. RentIt ne le calcule ni ne le prélève.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="category">{t('editItem.categoryLabel')}</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            >
              {/* Шестая копия списка была вписана прямо в разметку: добавь
                  категорию в продукт — и её не будет только здесь. */}
              <option value="">{t('editItem.selectCategory')}</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="condition">{t('editItem.conditionLabel')}</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            >
              <option value="">{t('editItem.selectCondition')}</option>
              {CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="address">{t('editItem.addressLabel')}</label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">{t('form.photoReplaceLabel')}</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ width: '100%' }}
            />
            {uploading && <p>{t('form.uploading')}</p>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={updateItemMutation.isPending || uploading}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {updateItemMutation.isPending ? t('editItem.updating') : t('editItem.updateButton')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditItem;