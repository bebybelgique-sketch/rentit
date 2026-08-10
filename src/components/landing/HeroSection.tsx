// src/components/landing/HeroSection.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const HeroSection: React.FC = () => {
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [searchWhat, setSearchWhat] = useState('');
  const [searchWhere, setSearchWhere] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Логика получения toolCount остается
    import('../../lib/supabase').then(({ supabase }) => {
        supabase.from('items').select('id', { count: 'exact', head: true })
          .eq('available', true)
          .then(({ count }) => setToolCount(count))
    });
  }, []);

  return (
    <section style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: '56px', position: 'relative' }}>

      {/* Grid lines background — subtle architectural element */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${(i + 1) * (100 / 7)}%`,
            borderLeft: '1px solid rgba(242,240,235,0.04)',
          }} />
        ))}
      </div>

      <div className="L-wrap" style={{ position: 'relative', zIndex: 1, paddingBottom: '80px' }}>

        {/* Eyebrow */}
        <div className="L-fadein L-fadein-delay-1" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
          <span className="L-label">Location d'outils P2P — Brabant Wallon — Est. 2026</span>
        </div>

        {/* Main headline */}
        <h1 className="L-display L-fadein L-fadein-delay-2"
          style={{ fontSize: 'clamp(34px, 8vw, 104px)', color: 'var(--white)', maxWidth: '1100px', marginBottom: '32px' }}>
          Les outils de votre voisin,{' '}
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>à portée de main.</span>
        </h1>

        {/* Live tool counter */}
        {toolCount !== null && (
          <div className="L-fadein L-fadein-delay-2" style={{ display: 'flex', width: 'fit-content', maxWidth: '100%', alignItems: 'center', gap: '8px', marginBottom: '32px', padding: '8px 16px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'var(--mono)', color: 'var(--muted)', overflow: 'hidden' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
            {toolCount} outil{toolCount > 1 ? 's' : ''} disponible{toolCount > 1 ? 's' : ''} en Brabant Wallon
          </div>
        )}

        {/* Search bar */}
        <div className="L-fadein L-fadein-delay-3" style={{ marginBottom: '40px' }}>
          <div className="L-search">
            <div className="L-search-field">
              <span className="L-label" style={{ fontSize: '9px', marginBottom: '2px' }}>WHAT</span>
              <input
                placeholder="Perceuse, nettoyeur haute pression, ponceuse…"
                value={searchWhat}
                onChange={e => setSearchWhat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/browse${searchWhat.trim() ? `?q=${encodeURIComponent(searchWhat.trim())}` : ''}`)}
              />
            </div>
            <div className="L-search-field">
              <span className="L-label" style={{ fontSize: '9px', marginBottom: '2px' }}>WHERE</span>
              <input
                placeholder="Wavre, Ottignies, Waterloo…"
                value={searchWhere}
                onChange={e => setSearchWhere(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const p = new URLSearchParams(); if (searchWhat.trim()) p.set('q', searchWhat.trim()); if (searchWhere.trim()) p.set('where', searchWhere.trim()); navigate(`/browse?${p.toString()}`) } }}
              />
            </div>
            <button
              className="L-search-btn"
              onClick={() => { const p = new URLSearchParams(); if (searchWhat.trim()) p.set('q', searchWhat.trim()); if (searchWhere.trim()) p.set('where', searchWhere.trim()); navigate(`/browse?${p.toString()}`) }}
            >Rechercher →</button>
          </div>
        </div>

        {/* Bottom row */}
        <div className="L-fadein L-fadein-delay-3" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '32px' }}>
          <div style={{ maxWidth: '420px' }}>
            <p className="L-body" style={{ fontSize: '16px', marginBottom: '24px' }}>
              Louez des outils professionnels à vos voisins. Moins cher qu'acheter, disponible en quelques minutes. Protection incluse gratuitement.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link to="/browse" className="L-btn-primary">Voir les outils →</Link>
              <Link to="/list-item" className="L-btn-ghost">Déposer une annonce</Link>
            </div>
          </div>

          {/* Stats — architectural, minimal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)' }} className="L-hide-sm">
            {[
              { n: toolCount !== null ? `${toolCount}` : '—', l: 'Outils dispo' },
              { n: '5 km', l: 'Distance moy.' },
              { n: '0%', l: 'Commission' },
            ].map(s => (
              <div key={s.l} style={{ background: 'var(--black)', padding: '24px 28px' }}>
                <div className="L-display" style={{ fontSize: '40px', color: 'var(--white)', marginBottom: '4px' }}>{s.n}</div>
                <div className="L-label">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="L-scroll-hint" style={{ position: 'absolute', bottom: '32px', right: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <span className="L-label" style={{ fontSize: '9px' }}>SCROLL</span>
        <div style={{ width: '1px', height: '40px', background: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '40%', background: 'var(--muted)',
            animation: 'fadeUp 1.8s ease-in-out infinite',
          }} />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;