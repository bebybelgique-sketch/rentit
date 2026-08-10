// src/pages/AddItem.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCreateItem } from '../hooks/mutations/useCreateItem';
import { useUploadImage } from '../hooks/useUploadImage';

const AddItem: React.FC = () => {
  const { user } = useAuth();
  const createItemMutation = useCreateItem();
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

  if (!user) {
    return (
      <div className="page">
        <div className="loading">Se connecter pour ajouter un outil</div>
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

    if (!imageFile) {
      alert("Veuillez sélectionner une image.");
      return;
    }

    try {
      // 1. Загрузить изображение
      const imageUrl = await uploadImage(imageFile, 'items');
      // 2. Создать товар, передав URL изображения
      await createItemMutation.mutateAsync({
        ...formData,
        imageUrl, // Передаем URL
        userId: user.id, // Передаем ID пользователя
      });
      // 3. Перенаправить или очистить форму
      alert("Outil ajouté avec succès!");
      setFormData({
        title: '',
        description: '',
        price_per_day: 0,
        deposit: 0,
        category: '',
        condition: '',
        address: '',
        lat: null,
        lng: null,
        available: true,
      });
      setImageFile(null);
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'outil:", error);
      alert("Une erreur s'est produite lors de l'ajout de l'outil.");
    }
  };

  return (
    <div className="page">
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>Ajouter un nouvel outil</h1>

        {createItemMutation.isError && <div className="error-msg">Erreur: {(createItemMutation.error as Error).message}</div>}
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
            <label htmlFor="image">Image</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              required
              style={{ width: '100%' }}
            />
            {uploading && <p>Upload en cours...</p>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={createItemMutation.isPending || uploading}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {createItemMutation.isPending ? 'Ajout en cours...' : 'Ajouter l\'outil'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddItem;