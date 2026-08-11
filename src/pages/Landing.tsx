import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useItems } from '../hooks/useItems';
import ItemCard from '../components/items/ItemCard';
import ItemCardSkeleton from '../components/common/ItemCardSkeleton';

// Импортируем новые компоненты
import HeroSection from '../components/landing/HeroSection';
import CategoriesSection from '../components/landing/CategoriesSection';

// ─── DESIGN PHILOSOPHY: "Negative Space Capitalism" ──────────────────────────
// The luxury of emptiness. What is NOT on the page sells harder than what is.
// Inspired by: Loro Piana brand books, Bottega Veneta digital, Linear.app
// 
// Rules:
// 1. Every element earns its place or gets cut
// 2. Spacing IS the design — 160px sections, 24px grids
// 3. One accent: #ADFF2F (electric chartreuse) — used 3 times max
// 4. Type as architecture — Syne 800 + DM Mono for contrast
// 5. No drop shadows. No gradients. No rounded corners > 4px.
// 6. Borders as furniture, not decoration
// 7. Motion: 0.4s ease — nothing faster, nothing slower

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Mono:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --sans: 'Syne', sans-serif;
  --mono: 'DM Mono', monospace;
}

/* ── DARK (default) ─────────────────────────── */
.L {
  --black:    #080808;
  --white:    #F2F0EB;
  --muted:    rgba(242,240,235,0.7);
  --border:   rgba(242,240,235,0.1);
  --accent:   #ADFF2F;
  --nav-bg:   rgba(8,8,8,0.85);
  --bg-alt:   #050505;
  --earn-sep: rgba(242,240,235,0.1);
  background: var(--black); color: var(--white);
  font-family: var(--sans); -webkit-font-smoothing: antialiased;
  transition: background 0.35s, color 0.35s;
  overflow-x: hidden;
}

/* ── LIGHT ──────────────────────────────────── */
.L.light {
  --black:    #F2F1EC;
  --white:    #111111;
  --muted:    rgba(17,17,17,0.7);
  --border:   rgba(17,17,17,0.12);
  --accent:   #ADFF2F;
  --nav-bg:   rgba(242,241,236,0.92);
  --bg-alt:   #E8E6E0;
  --earn-sep: rgba(17,17,17,0.12);
}

/* ── THEME TOGGLE BUTTON ─────────────────────── */
.L-theme-btn {
  width: 36px; height: 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: border-color 0.25s;
  flex-shrink: 0;
}
.L-theme-btn::after {
  content: '';
  position: absolute; top: 3px; left: 3px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.25s, background 0.25s;
}
.L.light .L-theme-btn::after {
  transform: translateX(16px);
  background: var(--accent);
}

/* ── TYPOGRAPHY ──────────────────────────────── */
.L-display {
  font-family: var(--sans);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 0.93;
}
.L-title {
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.0;
}
.L-label {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.L-body {
  font-family: var(--sans);
  font-weight: 400;
  font-size: 16px;
  line-height: 1.65;
  color: var(--muted);
}
.L-mono {
  font-family: var(--mono);
  font-weight: 300;
}

/* ── LAYOUT ──────────────────────────────────── */
.L-wrap { max-width: 1280px; margin: 0 auto; padding: 0 48px; }
.L-rule { border: none; border-top: 1px solid var(--border); }


/* ── BUTTONS ─────────────────────────────────── */
.L-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--sans); font-size: 13px; font-weight: 600;
  background: var(--white); color: var(--black);
  padding: 10px 22px; border-radius: 3px;
  text-decoration: none; transition: opacity 0.2s, transform 0.15s;
  letter-spacing: -0.01em; white-space: nowrap;
}
.L-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); text-decoration: none; color: var(--black); }

.L-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--sans); font-size: 13px; font-weight: 500;
  color: var(--white); background: transparent;
  padding: 9px 22px; border-radius: 3px;
  border: 1px solid var(--border);
  text-decoration: none; transition: border-color 0.2s, background 0.2s;
  letter-spacing: -0.01em; white-space: nowrap;
}
.L-btn-ghost:hover { border-color: rgba(242,240,235,0.4); background: rgba(242,240,235,0.04); text-decoration: none; color: var(--white); }

/* ── MARQUEE ─────────────────────────────────── */
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.L-marquee-track { display: flex; animation: marquee 24s linear infinite; width: max-content; }
.L-marquee-track:hover { animation-play-state: paused; }

/* ── CATEGORY ITEMS ──────────────────────────── */
.L-cat {
  display: block;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 4px;
  text-decoration: none; color: var(--white);
  transition: border-color 0.2s, background 0.2s;
  position: relative; overflow: hidden;
}
.L-cat::after {
  content: '↗';
  position: absolute; top: 20px; right: 20px;
  font-size: 16px; color: var(--accent);
  opacity: 0; transform: translate(-4px, 4px);
  transition: opacity 0.2s, transform 0.2s;
}
.L-cat:hover { border-color: rgba(173,255,47,0.25); background: rgba(173,255,47,0.03); text-decoration: none; color: var(--white); }
.L-cat:hover::after { opacity: 1; transform: translate(0,0); }

/* ── STEP ITEMS ──────────────────────────────── */
.L-step { padding: 40px 0; border-bottom: 1px solid var(--border); transition: background 0.2s; }
.L-step:last-child { border-bottom: none; }
.L-step:hover { background: rgba(242,240,235,0.015); }

/* ── TRUST BENTO ─────────────────────────────── */
.L-bento-item {
  padding: 32px; border: 1px solid var(--border); border-radius: 4px;
  transition: border-color 0.2s;
}
.L-bento-item:hover { border-color: rgba(242,240,235,0.2); }

/* ── OWNERS SECTION ──────────────────────────── */
.L-earn-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24px 0; border-bottom: 1px solid var(--earn-sep);
}
.L-earn-row:last-child { border-bottom: none; }

/* ── PLAN CARDS ──────────────────────────────── */
.L-plan {
  padding: 28px 24px; border-radius: 4px;
  display: flex; flex-direction: column; gap: 16px;
  transition: transform 0.2s;
}
.L-plan:hover { transform: translateY(-2px); }

/* ── SEARCH BAR ──────────────────────────────── */
.L-search {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
  background: rgba(242,240,235,0.03);
  max-width: 580px;
  width: 100%;
}
.L-search-field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 16px;
  border-right: 1px solid var(--border);
  gap: 3px;
  overflow: hidden;
}
.L-search-field:last-of-type { border-right: none; }
.L-search-field input {
  background: transparent; border: none; outline: none;
  color: var(--white); font-family: var(--sans);
  font-size: 14px; font-weight: 500;
  min-width: 0; width: 100%;
}
.L-search-field input::placeholder { color: var(--muted); font-weight: 400; }
.L-search-btn {
  padding: 0 24px; background: var(--white); color: var(--black);
  border: none; cursor: pointer; font-family: var(--sans);
  font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
  transition: opacity 0.2s; white-space: nowrap; flex-shrink: 0;
}
.L-search-btn:hover { opacity: 0.85; }

/* ── FADE IN ─────────────────────────────────── */
@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: no-preference) {
  .L-fadein { animation: fadeUp 0.7s ease forwards; }
  .L-fadein-delay-1 { animation-delay: 0.1s; opacity: 0; animation-fill-mode: forwards; }
  .L-fadein-delay-2 { animation-delay: 0.2s; opacity: 0; animation-fill-mode: forwards; }
  .L-fadein-delay-3 { animation-delay: 0.35s; opacity: 0; animation-fill-mode: forwards; }
}

/* Default column layout for responsive grid classes */
.L-sm-col   { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.L-sm-col-2 { display: grid; grid-template-columns: repeat(3, 1fr); }

@media (max-width: 900px) {
  .L-wrap { padding: 0 24px; }
  .L-nav-inner { padding: 0 24px; }
  .L-hide-sm { display: none !important; }
  .L-sm-col { grid-template-columns: 1fr !important; }
  .L-sm-col-2 { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 640px) {
  .L-wrap { padding: 0 16px; }
  .L-sm-col { grid-template-columns: 1fr !important; }
  .L-sm-col-2 { grid-template-columns: 1fr !important; }
  .L-search { flex-direction: column !important; }
  .L-search-field { border-right: none !important; border-bottom: 1px solid var(--border); }
  .L-search-btn { width: 100%; padding: 14px; }
  .L-scroll-hint { display: none !important; }
  .L-marquee-track { overflow: hidden; }
}
`

export default function Landing() {

  const [isDark] = useState(true)


  // Обновляем вызов useItems для получения isLoading и data
  const { data: liveItems, isLoading: liveItemsLoading, error } = useItems({ limit: 6, sortBy: 'created_at' });

  // ... (остальные useEffect остаются без изменений, если применимо) ...

  return (
    <div className={isDark ? 'L' : 'L light'}>
      <style>{CSS}</style>

      {/* Вставляем HeroSection */}
      <HeroSection />

      {/* ── MARQUEE — social proof ────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '14px 0', overflow: 'hidden' }}>
        <div className="L-marquee-track">
          {[...Array(2)].map((_, rep) => (
            ['Drills & Drivers', '—', 'Pressure Washers', '—', 'Concrete Mixers', '—', 'Laser Levels', '—', 'Tile Saws', '—', 'Scaffolding', '—', 'Hedge Trimmers', '—', 'Jackhammers', '—', 'Floor Sanders', '—', 'Welding Equipment', '—'].map((item, i) => (
              <span key={`${rep}-${i}`} className="L-mono" style={{ fontSize: '12px', color: 'var(--muted)', paddingRight: '32px', whiteSpace: 'nowrap' }}>
                {item}
              </span>
            ))
          ))}
        </div>
      </div>

      {/* Вставляем CategoriesSection */}
      <CategoriesSection />

      {/* ── COMMENT ÇA MARCHE ────────────────────────────────────────────── */}
      <section style={{ padding: '140px 0', borderTop: '1px solid var(--border)' }}>
        <div className="L-wrap">

          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '120px', alignItems: 'start' }} className="L-sm-col">
            <div style={{ position: 'sticky', top: '80px' }}>
              <div className="L-label" style={{ marginBottom: '20px' }}>Comment ça marche</div>
              <h2 className="L-title" style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: 'var(--white)', marginBottom: '20px' }}>
                Trois étapes.<br />Zéro friction.
              </h2>
              <p className="L-body" style={{ fontSize: '15px' }}>
                De la recherche au retour de l'outil. Pas de paperasse, pas d'appel — tout se passe ici.
              </p>
            </div>

            <div>
              {[
                {
                  n: '01', icon: '🔍', title: 'Trouvez l\'outil',
                  // «Chaque résultat est à moins de 5 km» было неверно трижды:
                  // фильтр по расстоянию по умолчанию выключен, радиус равен
                  // 10 км, и работает он только при включённой геолокации.
                  // Витрина же прямо предлагает расширить до 50 км — обещание
                  // и продукт противоречили друг другу в открытую.
                  desc: 'Parcourez par catégorie, mot-clé ou commune. Filtrez par dates : les outils déjà réservés disparaissent de la liste.',
                },
                {
                  // WhatsApp здесь обещался, но никогда не был подключён, а
                  // с 11.08 переписка живёт внутри брони (booking_messages).
                  n: '02', icon: '💬', title: 'Contactez le propriétaire',
                  desc: 'Envoyez un message depuis la réservation. Convenez du lieu et de l\'heure — simple et humain.',
                },
                {
                  n: '03', icon: '✅', title: 'Récupérez & profitez',
                  desc: 'Récupérez l\'outil, faites votre projet, retournez-le comme convenu. Laissez un avis. Construisez la confiance du quartier.',
                },
              ].map(step => (
                <div key={step.n} className="L-step" style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '24px', alignItems: 'start' }}>
                  <div style={{ paddingTop: '4px' }}>
                    <div className="L-mono" style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>{step.n}</div>
                    <div style={{ fontSize: '28px' }}>{step.icon}</div>
                  </div>
                  <div style={{ paddingBottom: '0' }}>
                    <h3 className="L-title" style={{ fontSize: '26px', color: 'var(--white)', marginBottom: '12px' }}>{step.title}</h3>
                    <p className="L-body" style={{ fontSize: '15px' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '140px 0', borderTop: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
        <div className="L-wrap">

          <div style={{ marginBottom: '72px' }}>
            {/* Заголовок раздела был «Protection» — под ним обещали
                страховку. Теперь под ним фотографии состояния и отзывы,
                то есть доверие, а не покрытие. */}
            <div className="L-label" style={{ marginBottom: '20px' }}>Confiance</div>
            <h2 className="L-title" style={{ fontSize: 'clamp(36px, 4vw, 64px)', color: 'var(--white)' }}>
              Fait pour la confiance.
            </h2>
          </div>

          {/* Bento grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '8px' }} className="L-sm-col">

            {/* Здесь обещалась «protection jusqu'à €500, incluse dans chaque
                location». Страхования нет: платформа не сторона договора и
                ничего не покрывает. Обещание защиты, которой не существует,
                опаснее любого другого — на него полагаются в тот момент,
                когда чужой инструмент уже сломан.
                Заменено на то, что площадка действительно даёт: фотографии
                состояния при передаче и возврате, видимые обеим сторонам. */}
            <div className="L-bento-item" style={{ gridRow: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '320px' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: '300', color: 'var(--accent)', marginBottom: '20px', letterSpacing: '-0.04em', fontSize: 'clamp(56px, 6vw, 80px)', lineHeight: 1 }}>
                  📷
                </div>
                <h3 className="L-title" style={{ fontSize: '22px', color: 'var(--white)', marginBottom: '12px' }}>Photos à la remise et au retour</h3>
                <p className="L-body" style={{ fontSize: '14px' }}>
                  L'état de l'outil est photographié au départ et au retour. Les deux parties voient les mêmes photos. Pas d'assurance, pas de promesse à votre place : une preuve claire, si le doute survient.
                </p>
              </div>
              <div className="L-label" style={{ marginTop: '40px' }}>Sur chaque réservation</div>
            </div>

            <div className="L-bento-item">
              <div style={{ marginBottom: '16px' }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M14 2L17.5 5.5H22.5V10.5L26 14L22.5 17.5V22.5H17.5L14 26L10.5 22.5H5.5V17.5L2 14L5.5 10.5V5.5H10.5L14 2Z" fill="var(--accent)" fillOpacity="0.15" stroke="var(--accent)" strokeWidth="1.5"/>
                  <path d="M9 14L12.5 17.5L19 11" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="L-title" style={{ fontSize: '18px', color: 'var(--white)', marginBottom: '8px' }}>Propriétaires vérifiés</h3>
              <p className="L-body" style={{ fontSize: '14px' }}>Profils vérifiés par téléphone. Notes publiques sur chaque annonce. Vraie responsabilité.</p>
            </div>

            <div className="L-bento-item">
              <div style={{ marginBottom: '16px' }}>
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                  <rect x="0.75" y="0.75" width="26.5" height="18.5" rx="3.25" stroke="var(--border)" strokeWidth="1.5"/>
                  <rect x="0" y="5" width="28" height="5" fill="var(--border)" fillOpacity="0.4"/>
                  <rect x="4" y="13" width="8" height="2.5" rx="1" fill="var(--muted)"/>
                  <rect x="15" y="13" width="5" height="2.5" rx="1" fill="var(--accent)" fillOpacity="0.7"/>
                </svg>
              </div>
              {/* Здесь обещались escrow и автоматический перевод. Ни того, ни
                  другого нет и не планируется: платформа денег не касается,
                  расчёт наличными между сторонами. */}
              <h3 className="L-title" style={{ fontSize: '18px', color: 'var(--white)', marginBottom: '8px' }}>Aucun paiement en ligne</h3>
              <p className="L-body" style={{ fontSize: '14px' }}>Le règlement se fait entre vous, en espèces, à la remise. La plateforme ne touche pas à l'argent.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOR OWNERS ───────────────────────────────────────────────────── */}
      <section style={{ padding: '140px 0', borderTop: '1px solid var(--border)' }}>
        <div className="L-wrap">

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="L-sm-col">

            <div>
              <div className="L-label" style={{ marginBottom: '20px' }}>Pour les propriétaires</div>
              <h2 className="L-title" style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: 'var(--white)', marginBottom: '24px' }}>
                Vos outils.<br />Qui rapportent.
              </h2>
              <p className="L-body" style={{ marginBottom: '32px', fontSize: '15px' }}>
                Déposez une annonce en 5 min. Vous êtes payé en main propre, à la remise. Gratuit aujourd'hui.
              </p>
              <ul style={{ listStyle: 'none', marginBottom: '36px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  'Annonce en 5 minutes',
                  "Aucune commission aujourd'hui",
                  "Photos de l'état à la remise et au retour",
                  'Gratuit pour démarrer',
                ].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    <span style={{ color: 'var(--accent)', fontSize: '16px' }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/list-item" className="L-btn-primary">Déposer un outil — gratuit</Link>
              </div>
            </div>

            {/* Earnings panel */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <span className="L-label">Revenus par location</span>
              </div>

              {/* Тариф «8% frais plateforme» описывал удержание из выплаты,
                  которой не существует: платформа не касается денег. Строка о
                  будущей платности остаётся — бесплатно сегодня не значит
                  бесплатно всегда, — но сформулирована как намерение, а не как
                  действующее удержание. */}
              {/* Обе строки показывали «100%»: таблица сравнения сравнивала
                  одинаковое. Это осталось от прежнего тарифа «92% / 8% frais
                  plateforme», когда числа действительно различались. Сравнивать
                  нечего — платформа денег не касается ни сегодня, ни в
                  обозримом будущем, поэтому колонка процентов убрана. */}
              {[
                { plan: "Aujourd'hui", cut: 'Gratuit', note: 'Vous gardez tout · règlement en espèces', accent: true },
                { plan: 'Plus tard', cut: 'Annoncé', note: 'Des options payantes viendront · jamais sans accord préalable', accent: false },
              ].map(row => (
                <div key={row.plan} className="L-earn-row" style={{ padding: '28px 24px', borderBottom: '1px solid var(--border)', background: row.accent ? 'rgba(173,255,47,0.04)' : 'transparent' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: '15px', fontWeight: '600', color: row.accent ? 'var(--accent)' : 'var(--white)', marginBottom: '4px' }}>
                      {row.plan}
                    </div>
                    <div className="L-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>{row.note}</div>
                  </div>
                  <div>
                    <div className="L-display" style={{ fontSize: '52px', color: row.accent ? 'var(--accent)' : 'var(--white)', letterSpacing: '-0.04em', textAlign: 'right' }}>
                      {row.cut}
                    </div>
                    <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', marginTop: '8px', width: '80px' }}>
                      <div style={{ height: '100%', width: row.accent ? '100%' : '88%', background: row.accent ? 'var(--accent)' : 'var(--muted)', borderRadius: '1px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }} />
                <span className="L-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>Le règlement se fait entre vous, en espèces</span>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ── LIVE LISTINGS ────────────────────────────────────────────────── */}
      {/* Обновляем условия отображения */}
      {liveItemsLoading ? (
        <section style={{ padding: '140px 0', borderTop: '1px solid var(--border)' }}>
          <div className="L-wrap">
            <div style={{ gap: '8px' }} className="L-sm-col-2">
              {Array.from({ length: 6 }).map((_, i) => <ItemCardSkeleton key={i} />)}
            </div>
          </div>
        </section>
      ) : error ? (
        <section style={{ padding: '140px 0', borderTop: '1px solid var(--border)' }}>
          <div className="L-wrap">
            <p style={{ color: 'var(--muted)' }}>
              Impossible de charger les outils pour le moment. Réessayez dans un instant.
            </p>
          </div>
        </section>
      ) : liveItems && liveItems.length > 0 && (
        <section style={{ padding: '140px 0', borderTop: '1px solid var(--border)' }}>
          <div className="L-wrap">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '56px', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <div className="L-label" style={{ marginBottom: '16px' }}>Disponibles maintenant</div>
                <h2 className="L-title" style={{ fontSize: 'clamp(32px, 3.5vw, 52px)', color: 'var(--white)' }}>
                  Outils près de chez vous
                </h2>
              </div>
              <Link to="/browse"
                className="L-mono"
                style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                Voir tout ↗
              </Link>
            </div>

            <div style={{ gap: '8px' }} className="L-sm-col-2">
              {/* Используем новый компонент ItemCard */}
              {liveItems.map(item => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA BAND ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '120px 0', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="L-wrap">
          <div className="L-label" style={{ marginBottom: '24px', display: 'block' }}>Prêt à commencer</div>
          <h2 className="L-display" style={{ fontSize: 'clamp(44px, 6vw, 84px)', color: 'var(--white)', marginBottom: '40px' }}>
            Les outils de vos voisins<br />
            vous <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>attendent.</span>
          </h2>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/browse" className="L-btn-primary" style={{ padding: '14px 32px', fontSize: '15px' }}>Voir les outils →</Link>
            <Link to="/register" className="L-btn-ghost" style={{ padding: '14px 32px', fontSize: '15px' }}>Créer un compte</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 0' }}>
        <div className="L-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--sans)', fontSize: '16px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--white)' }}>
              Rent<span style={{ color: 'var(--accent)' }}>It</span>
            </span>
            <span className="L-mono" style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>
              Belgium · {new Date().getFullYear()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            {[
              { label: 'Parcourir', to: '/browse' },
              { label: 'Inscription', to: '/register' },
              { label: 'Confidentialité', to: '/privacy' },
              { label: 'CGU', to: '/terms' },
            ].map(l => (
              <Link key={l.to} to={l.to}
                className="L-mono"
                style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s', letterSpacing: '0.04em' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
