// src/pages/EditItem.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useItemById } from '../hooks/useItemById';
import { useUpdateItem, type ItemUpdate } from '../hooks/mutations/useUpdateItem';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, CONDITIONS } from '../domain/catalog';
import { useUploadImage } from '../hooks/useUploadImage';
import { supabase } from '../lib/supabase';
import { ITEM_PHOTOS_BUCKET, itemPhotoPath } from '../lib/itemPhotos';
import { photosOf } from '../lib/items';
import ItemBlackouts from '../components/ItemBlackouts';

// Те же границы, что проверками в базе (миграция 20260817000022).
const MAX_QUANTITY = 999;
const MAX_NOTICE_DAYS = 90;
const MAX_BUFFER_DAYS = 30;

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
    // Доставка держится строками по той же причине, что и тарифы: пустое
    // поле — «услуги нет», и это не ноль.
    delivery_fee: '' as string,
    delivery_radius_km: '' as string,
    deposit: 0,
    category: '',
    condition: '',
    address: '',
    lat: null as number | null,
    lng: null as number | null,
    available: true,
    quantity: 1,
    min_notice_days: 0,
    buffer_days: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Тумблер доставки — интерфейс поверх одного поля: в базе признак услуги
  // ровно один, непустая delivery_fee. Второй колонки «включено» нет
  // намеренно, иначе она разойдётся с ценой.
  const [delivers, setDelivers] = useState(false);

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
        delivery_fee: item.delivery_fee == null ? '' : String(item.delivery_fee),
        delivery_radius_km: item.delivery_radius_km == null ? '' : String(item.delivery_radius_km),
        deposit: item.deposit || 0,
        category: item.category || '', // Assuming category is part of the Item type
        condition: item.condition || '', // Assuming condition is part of the Item type
        address: item.address ?? '',
        lat: item.lat,
        lng: item.lng,
        available: item.available,
        quantity: item.quantity ?? 1,
        min_notice_days: item.min_notice_days ?? 0,
        buffer_days: item.buffer_days ?? 0,
      });
      // Галка восстанавливается из единственного признака услуги — цены.
      // Отдельного «включено» в базе нет, и хранить его негде.
      setDelivers(item.delivery_fee != null);
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
  // Не просто надпись: со страницы должен быть выход. Страница вещи в том же
  // случае предлагает «Parcourir» и «Accueil», а здесь человек упирался в
  // одну строку и навбар — иди догадайся, куда именно.
  if (!item) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div className="loading" style={{ marginBottom: '24px' }}>{t('editItem.notFound')}</div>
      <Link to="/my-items" className="btn btn-primary">{t('editItem.backToMyItems')}</Link>
    </div>
  );

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

  // Целые поля доступности. Общий handleChange гонит любое числовое поле
  // через parseFloat, и пустая строка стала бы NaN — то есть «одна
  // единица» превратилось бы в мусор при первом же касании.
  const handleInt = (key: 'quantity' | 'min_notice_days' | 'buffer_days', min: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseInt(e.target.value, 10);
      setFormData(prev => ({ ...prev, [key]: Number.isInteger(n) ? n : min }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ответ человеку здесь, а не отказом Postgres по-английски. Границы те
    // же, что проверками в базе.
    for (const [value, label, min, max] of [
      [formData.quantity, t('listItem.quantityLabel'), 1, MAX_QUANTITY],
      [formData.min_notice_days, t('listItem.noticeLabel'), 0, MAX_NOTICE_DAYS],
      [formData.buffer_days, t('listItem.bufferLabel'), 0, MAX_BUFFER_DAYS],
    ] as const) {
      if (!Number.isInteger(value) || value < min || value > max) {
        alert(t('listItem.numberRange', { label, min, max }));
        return;
      }
    }

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

      const { price_3days, price_week, late_fee_per_day, delivery_fee, delivery_radius_km, ...rest } = formData;

      // Включённая доставка без цены — обещание услуги, условий которой
      // никто не знает. Пустое поле здесь НЕ приводим молча к «услуги нет»:
      // владелец видел галку включённой и ждёт, что она сохранится.
      if (delivers && !(parseFloat(delivery_fee) > 0))
        throw new Error(t('listItem.deliveryFeeRequired'));
      if (delivers && delivery_radius_km.trim() !== '' && !(parseInt(delivery_radius_km, 10) > 0))
        throw new Error(t('listItem.deliveryRadiusMustBePositive'));

      const updates: ItemUpdate = {
        ...rest,
        price_3days: tier(price_3days, t('listItem.package3Days')),
        price_week: tier(price_week, t('listItem.packageWeek')),
        late_fee_per_day: tier(late_fee_per_day, t('listItem.lateFeesLabel')),
        // Выключенный тумблер стирает обе колонки: снятая галка обязана
        // означать «не вожу», а не «вожу, но цену больше не показываю».
        delivery_fee: delivers ? parseFloat(delivery_fee) : null,
        delivery_radius_km: delivers && delivery_radius_km.trim() !== '' ? parseInt(delivery_radius_km, 10) : null,
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
        const previous = photosOf(item);
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
            {/* Тот же текст уже жил в словарях как listItem.lateFeeNote —
                здесь стояла его французская копия, и она же показывалась
                англичанину. */}
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '5px', lineHeight: 1.5 }}>
              {t('listItem.lateFeeNote')}
            </p>
          </div>

          {/* Доставка. Галка снята у всех, кто её не включал: услуги не
              существует, пока владелец не назвал цену. */}
          <div className="form-group">
            <label htmlFor="delivers" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                id="delivers"
                name="delivers"
                type="checkbox"
                checked={delivers}
                onChange={e => {
                  const on = e.target.checked;
                  setDelivers(on);
                  // Снятая галка чистит поля: иначе цена осталась бы в форме
                  // невидимой и вернулась бы при следующем включении как
                  // «уже согласованная».
                  if (!on) setFormData(prev => ({ ...prev, delivery_fee: '', delivery_radius_km: '' }));
                }}
                style={{ width: 'auto' }}
              />
              {t('listItem.deliveryToggle')}
            </label>

            {delivers && (
              <>
                <label htmlFor="delivery_fee" style={{ marginTop: '10px', display: 'block' }}>{t('listItem.deliveryFeeLabel')}</label>
                <input
                  id="delivery_fee"
                  name="delivery_fee"
                  type="number"
                  value={formData.delivery_fee}
                  onChange={e => setFormData(prev => ({ ...prev, delivery_fee: e.target.value }))}
                  min="0.50"
                  step="0.50"
                  placeholder={t('listItem.deliveryFeeHint')}
                  style={{ width: '100%' }}
                />
                <label htmlFor="delivery_radius_km" style={{ marginTop: '10px', display: 'block' }}>
                  {t('listItem.deliveryRadiusLabel')} <span style={{ color: 'var(--muted)', fontWeight: '400' }}>{t('common.optional')}</span>
                </label>
                <input
                  id="delivery_radius_km"
                  name="delivery_radius_km"
                  type="number"
                  value={formData.delivery_radius_km}
                  onChange={e => setFormData(prev => ({ ...prev, delivery_radius_km: e.target.value }))}
                  min="1"
                  step="1"
                  placeholder={t('listItem.deliveryRadiusHint')}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '5px', lineHeight: 1.5 }}>
                  {t('listItem.deliveryNote')}
                </p>
              </>
            )}
          </div>

          {/* Доступность: количество единиц, срок предупреждения, зазор
              после возврата. Занятость по ним считает база — правило одно
              на витрину, календарь и запись брони. */}
          <div className="form-group">
            <label htmlFor="quantity">{t('listItem.quantityLabel')}</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max={MAX_QUANTITY}
              step="1"
              value={formData.quantity}
              onChange={handleInt('quantity', 1)}
              style={{ width: '100%' }}
            />
            <p className="form-hint">{t('listItem.quantityHint')}</p>
          </div>

          <div className="form-group">
            <label htmlFor="min_notice_days">{t('listItem.noticeLabel')}</label>
            <input
              id="min_notice_days"
              name="min_notice_days"
              type="number"
              min="0"
              max={MAX_NOTICE_DAYS}
              step="1"
              value={formData.min_notice_days}
              onChange={handleInt('min_notice_days', 0)}
              style={{ width: '100%' }}
            />
            <p className="form-hint">{t('listItem.noticeHint')}</p>
          </div>

          <div className="form-group">
            <label htmlFor="buffer_days">{t('listItem.bufferLabel')}</label>
            <input
              id="buffer_days"
              name="buffer_days"
              type="number"
              min="0"
              max={MAX_BUFFER_DAYS}
              step="1"
              value={formData.buffer_days}
              onChange={handleInt('buffer_days', 0)}
              style={{ width: '100%' }}
            />
            <p className="form-hint">{t('listItem.bufferHint')}</p>
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

        {/* Вне <form> намеренно: вложенная форма — невалидная разметка, а
            перерывы сохраняются сами, отдельно от полей вещи. */}
        <ItemBlackouts itemId={itemId!} />
      </div>
    </div>
  );
};

export default EditItem;