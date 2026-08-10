// src/components/common/ItemCardSkeleton.tsx
import React from 'react';

const ItemCardSkeleton: React.FC = () => {
  return (
    <div style={{
      border: '1px solid var(--border)',
      backgroundColor: 'var(--bg-alt)',
      overflow: 'hidden',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ aspectRatio: '4/3', background: 'var(--border)' }} />
      <div style={{ padding: '16px 20px' }}>
        <div style={{ height: '16px', background: 'var(--border)', marginBottom: '8px', width: '70%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ height: '12px', background: 'var(--border)', width: '40%' }} />
          <div style={{ height: '16px', background: 'var(--accent)', width: '20%', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  );
};

export default ItemCardSkeleton;