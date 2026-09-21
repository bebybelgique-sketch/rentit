// src/components/items/ItemCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import type { Item } from '../../types';
import { coverPhoto } from '../../lib/items';
import CategoryIcon from '../icons/CategoryIcon';

interface ItemCardProps {
  item: Item;
}

const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
  const cover = coverPhoto(item);

  return (
    <Link
      to={`/item/${item.id}`}
      style={{
        textDecoration: 'none',
        display: 'block',
        border: '1px solid var(--border)',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--muted)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {cover ? (
        <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
          <img
            src={cover}
            loading="lazy"
            decoding="async"
            alt={item.title ?? 'Item'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.4s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = 'scale(1.03)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = 'scale(1)')}
          />
        </div>
      ) : (
        <div style={{ aspectRatio: '4/3', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Был 🔧 в 40 px. Живая карточка витрины (BrowseCard в Home.tsx)
              рисует здесь CategoryIcon по категории вещи — этот компонент ту
              правку не получил. Теперь оба в одном языке.
              ⚠️ ItemCard не используется ни одной страницей: его держит
              только собственный тест. Дубль живой BrowseCard. Не удаляю при
              багфиксе — это отдельное решение. */}
          <span style={{ color: 'var(--silver-edge)' }}>
            <CategoryIcon category={item.category ?? ''} size={40} />
          </span>
        </div>
      )}
      <div style={{ padding: '16px 20px' }}>
        <div style={{
          fontFamily: 'var(--sans)',
          fontSize: '15px',
          fontWeight: '600',
          color: 'var(--white)',
          marginBottom: '6px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {item.title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="L-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {item.address?.split(',')[0] || 'Bruxelles'}
          </span>
          <span className="L-mono" style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '500' }}>
            €{item.price_per_day ?? 0}/jour
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ItemCard;