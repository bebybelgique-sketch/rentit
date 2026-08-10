// src/components/landing/CategoriesSection.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const CategoriesSection: React.FC = () => {
  return (
    <section style={{ padding: '140px 0' }}>
      <div className="L-wrap">

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '80px', alignItems: 'start', marginBottom: '64px' }} className="L-sm-col">
          <div>
            <div className="L-label" style={{ marginBottom: '20px' }}>Ce que vous pouvez louer</div>
            <h2 className="L-title" style={{ fontSize: 'clamp(36px, 4vw, 60px)', color: 'var(--white)' }}>
              Outils professionnels.<br />De voisin à voisin.
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: '4px' }}>
            <Link to="/browse" style={{ color: 'var(--muted)', fontSize: '14px', textDecoration: 'none', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
              Voir tous les outils ↗
            </Link>
          </div>
        </div>

        <div style={{ gap: '8px' }} className="L-sm-col-2">
          {[
            { icon: '⚡', label: 'Électroportatif', desc: 'Perceuses, scies, meuleuses, défonceuses', slug: 'power_tools' },
            { icon: '🔧', label: 'Outillage manuel', desc: 'Marteaux, clés, pinces, étaux', slug: 'hand_tools' },
            { icon: '🌿', label: 'Jardin & Extérieur', desc: 'Tondeuses, taille-haies, souffleurs', slug: 'garden' },
            { icon: '🏗️', label: 'Construction', desc: 'Échafaudages, bétonnières, compresseurs', slug: 'construction' },
            { icon: '🧹', label: 'Nettoyage', desc: 'Nettoyeurs HP, autolaveuses', slug: 'cleaning' },
            { icon: '📐', label: 'Mesure', desc: 'Niveaux laser, détecteurs, testeurs', slug: 'measuring' },
          ].map(c => (
            <Link key={c.slug} to={`/browse?category=${c.slug}`} className="L-cat">
              <div style={{ fontSize: '24px', marginBottom: '20px' }}>{c.icon}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: '15px', fontWeight: '600', marginBottom: '6px', color: 'var(--white)' }}>
                {c.label}
              </div>
              <div className="L-mono" style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;