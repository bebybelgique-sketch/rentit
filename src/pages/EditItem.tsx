// src/pages/EditItem.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useItemById } from '../hooks/useItemById';
import { useUpdateItem } from '../hooks/mutations/useUpdateItem';
import { useUploadImage } from '../hooks/useUploadImage';

const EditItem: React.FC = () => {
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
        <div className="loading">Se connecter pour modifier un outil</div>
      </div>
    );
  }

  if (itemLoading) return <div className="page"><div className="loading">Chargement de l'outil...</div></div>;
  if (itemError) return <div className="page"><div className="loading">Erreur: {itemError.message}</div></div>;
  if (!item) return <div className="page"><div className="loading">Outil introuvable</div></div>;

  // Проверка, является ли пользователь владельцем
  if (item.owner_id !== user.id) {
    return (
      <div className="page">
        <div className="loading">Accès refusé. Vous n'êtes pas le propriétaire de cet outil.</div>
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
      let imageUrl = item.image_url; // Сохраняем старый URL, если не загружаем новый
      if (imageFile) {
        // Если выбрано новое изображение, загружаем его
        imageUrl = await uploadImage(imageFile, 'items');
      }

      // Обновить товар, передав URL изображения (новый или старый)
      await updateItemMutation.mutateAsync({
        id: itemId!,
        updates: {
          ...formData,
          image_url: imageUrl, // Обновляем поле image_url
          // Обновляем поля, соответствующие структуре Supabase
          photos: imageUrl ? [imageUrl] : [],
          address: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          available: formData.available,
        },
        userId: user.id,
      });
      // Перенаправить на страницу просмотра или список
      alert("Outil mis à jour avec succès!");
      navigate(`/item/${itemId}`);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'outil:", error);
      alert("Une erreur s'est produite lors de la mise à jour de l'outil.");
    }
  };

  return (
    <div className="page">
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>Modifier l'outil</h1>

        {updateItemMutation.isError && <div className="error-msg">Erreur: {(updateItemMutation.error as Error).message}</div>}
        {uploadError && <div className="error-msg">Erreur d'upload: {uploadError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Titre</label>
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
            <label htmlFor="description">Description</label>
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
            <label htmlFor="price_per_day">Prix par jour (€)</label>
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
            <label htmlFor="deposit">Dépôt (€)</label>
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

          <div className="form-group">
            <label htmlFor="category">Catégorie</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            >
              <option value="">Sélectionnez une catégorie</option>
              <option value="power_tools">⚡ Électroportatif</option>
              <option value="hand_tools">🔧 Outillage manuel</option>
              <option value="garden">🌿 Jardinage</option>
              <option value="construction">🏗️ Construction</option>
              <option value="cleaning">🧹 Nettoyage</option>
              <option value="measuring">📐 Mesure & Détection</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="condition">État</label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            >
              <option value="">Sélectionnez un état</option>
              <option value="new">Neuf</option>
              <option value="like_new">Comme neuf</option>
              <option value="good">Bon état</option>
              <option value="fair">Correct</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="address">Adresse</label>
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
            <label htmlFor="image">Image (laisser vide pour conserver l'actuelle)</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ width: '100%' }}
            />
            {uploading && <p>Upload en cours...</p>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={updateItemMutation.isPending || uploading}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {updateItemMutation.isPending ? 'Mise à jour en cours...' : 'Mettre à jour l\'outil'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditItem;