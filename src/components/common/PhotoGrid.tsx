// src/components/common/PhotoGrid.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface PhotoGridItem {
  id: string;
  url: string;
  phase: 'handover' | 'return';
  uploadedAt: string;
  canRemove?: boolean;
}

interface PhotoGridProps {
  photos: PhotoGridItem[];
  onRemove?: (id: string) => void;
  emptyLabel?: string;
}

const PHASE_TITLE: Record<'handover' | 'return', string> = {
  handover: 'Remise',
  return: 'Retour',
};

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos, onRemove, emptyLabel,
}) => {
  const { t } = useTranslation();
  const defaultEmptyLabel = emptyLabel || t('photoGrid.noPhotos');
  const PHASE_ALT: Record<'handover' | 'return', string> = {
    handover: t('photoGrid.titleHandover'),
    return: t('photoGrid.titleReturn'),
  };
  if (photos.length === 0) {
    return <p style={{ fontSize: '13px', color: '#666' }}>{defaultEmptyLabel}</p>;
  }

  // Порядок фиксированный: сначала как отдали, потом как вернули. Иначе
  // сравнивать состояние приходится, выискивая подписи глазами.
  const phases: Array<'handover' | 'return'> = ['handover', 'return'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {phases.map((phase) => {
        const group = photos.filter((p) => p.phase === phase);
        if (group.length === 0) return null;
        return (
          <div key={phase}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#888', marginBottom: '6px' }}>
              {PHASE_TITLE[phase]}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {group.map((p) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <img
                    src={p.url}
                    alt={PHASE_ALT[phase]}
                    style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                  />
                  {p.canRemove && onRemove && (
                    <button
                      type="button"
                      aria-label={t('photoGrid.deletePhoto')}
                      onClick={() => onRemove(p.id)}
                      style={{
                        position: 'absolute', top: '2px', right: '2px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
                        cursor: 'pointer', fontSize: '12px', lineHeight: 1, padding: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PhotoGrid;
