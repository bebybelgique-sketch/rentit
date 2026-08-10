import React, { useState } from 'react'

type Lang = 'en' | 'fr' | 'nl'

const LAST_UPDATED = 'March 20, 2026'
const COMPANY = 'RentIt'
const EMAIL = 'legal@rentit.be'
const SUPPORT_EMAIL = 'support@rentit.be'
const ADDRESS = 'Belgium'
const GOVERNING_LAW = 'Belgian law'

export default function TermsOfService() {
  const [lang, setLang] = useState<Lang>('en')

  return (
    <div className="page">
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {(['en', 'fr', 'nl'] as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`btn btn-sm ${lang === l ? 'btn-primary' : 'btn-secondary'}`}
            >
              {l === 'en' ? 'English' : l === 'fr' ? 'Français' : 'Nederlands'}
            </button>
          ))}
        </div>

        {lang === 'en' && <TermsEN />}
        {lang === 'fr' && <TermsFR />}
        {lang === 'nl' && <TermsNL />}
      </div>
    </div>
  )
}

function TermsEN() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Terms of Service</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Last updated: {LAST_UPDATED}</p>

      <div className="card" style={{ marginBottom: '24px', background: '#fff8e1', border: '1px solid #fde68a' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Important:</strong> By creating an account or using RentIt, you agree to these Terms. Please read them carefully. If you do not agree, do not use the platform.
        </p>
      </div>

      <Section title="1. About RentIt">
        <p>{COMPANY} is a peer-to-peer marketplace that connects people who want to rent tools and equipment ("Renters") with people who own them ("Owners"). RentIt is a platform intermediary — we do not own, inspect, or guarantee any items listed.</p>
        <p>These Terms constitute a legally binding agreement between you and {COMPANY} ({ADDRESS}) under {GOVERNING_LAW}.</p>
      </Section>

      <Section title="2. Eligibility">
        <ul style={listStyle}>
          <li>You must be at least <strong>18 years old</strong> to use RentIt.</li>
          <li>You must provide accurate and complete registration information.</li>
          <li>You must have the legal right to rent out any item you list.</li>
          <li>One account per person. Creating multiple accounts is prohibited.</li>
        </ul>
      </Section>

      <Section title="3. User Accounts">
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you suspect unauthorised access.</p>
        <p>We may suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or receive repeated legitimate complaints.</p>
      </Section>

      <Section title="4. Listing Items (Owners)">
        <ul style={listStyle}>
          <li>You must own or have the legal right to rent the items you list.</li>
          <li>Listings must be accurate, complete, and not misleading. Photos must represent the actual item.</li>
          <li>You set your own price per day and optional deposit.</li>
          <li>You are responsible for ensuring the item is in the condition described, clean, safe to use, and in working order at the time of handover.</li>
          <li>You may not list items that are: illegal, dangerous without proper certification, stolen, or subject to a lien that prevents rental.</li>
          <li>By listing an item, you grant RentIt a non-exclusive, royalty-free licence to display your listing photos on the platform for marketing purposes.</li>
        </ul>

        <p><strong>Prohibited items include but are not limited to:</strong> weapons, explosives, items requiring professional operator licences you do not hold, hazardous materials.</p>
      </Section>

      <Section title="5. Renting Items (Renters)">
        <ul style={listStyle}>
          <li>Booking an item creates a binding agreement between you and the Owner.</li>
          <li>You must use rented items only for their intended purpose and in accordance with applicable laws.</li>
          <li>You are responsible for any damage, loss, or theft of the item during your rental period.</li>
          <li>You must return the item by the agreed end date in the same condition as received, normal wear excepted.</li>
          <li>Late returns may result in additional charges equivalent to the daily rate for each additional day.</li>
        </ul>
      </Section>

      <Section title="6. Payments and Fees">
        <p>All payments are processed by <strong>Stripe</strong> (Stripe, Inc.), a PCI-DSS Level 1 certified payment processor. By making a payment, you also agree to Stripe's terms of service.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Fee</Th>
              <Th>Amount</Th>
              <Th>Who pays</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Rental price', 'Set by Owner', 'Renter']} />
            <Tr data={['Deposit (if applicable)', 'Set by Owner — refundable', 'Renter (held, returned after rental)']} />
            <Tr data={['Insurance fee', '€3.00 per day', 'Renter (covers damage up to €500)']} />
            <Tr data={['Platform commission', '12% of rental price', 'Deducted from Owner\'s payout']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '10px', fontStyle: 'italic' }}>
          * During the beta period, platform commission and insurance fees are waived. Current pricing is always displayed at checkout.
        </p>

        <ul style={listStyle}>
          <li>Payment is charged in full at the time of booking confirmation.</li>
          <li>Deposits are returned within <strong>5 business days</strong> after the item is marked as returned in good condition.</li>
          <li>If a dispute arises, RentIt may hold the deposit pending resolution.</li>
          <li>Owner payouts are processed within <strong>5–7 business days</strong> after rental completion.</li>
        </ul>
      </Section>

      <Section title="7. Cancellations and Refunds">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Cancelled by</Th>
              <Th>Timing</Th>
              <Th>Refund</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Renter', 'More than 48h before start', '100% rental + deposit refund']} />
            <Tr data={['Renter', 'Less than 48h before start', '50% rental refund; deposit refunded']} />
            <Tr data={['Renter', 'After rental starts', 'No refund for days already elapsed']} />
            <Tr data={['Owner', 'Any time before start', '100% refund to Renter; Owner may receive a warning']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666' }}>Insurance fees (€3/day) are non-refundable once a rental has started.</p>
      </Section>

      <Section title="8. Insurance and Liability">
        <p>RentIt includes a <strong>basic damage insurance</strong> of €3 per day, covering accidental damage to the rented item up to <strong>€500 per rental</strong>. This insurance does not cover:</p>
        <ul style={listStyle}>
          <li>Intentional damage or negligence</li>
          <li>Theft of the item by the Renter</li>
          <li>Damage exceeding €500 (Renter remains liable for the excess)</li>
          <li>Third-party property damage or personal injury</li>
        </ul>
        <p>Renters remain fully liable for damage or loss beyond the insurance coverage. Owners are encouraged to take photos of items before and after each rental as evidence.</p>
        <p><strong>RentIt's liability</strong> is limited to the fees paid to RentIt in the 3 months preceding the event giving rise to the claim. RentIt is not liable for: loss of earnings, consequential or indirect damages, disputes between users, or item quality issues.</p>
      </Section>

      <Section title="9. Disputes Between Users">
        <p>RentIt is an intermediary and is not a party to rental agreements between Owners and Renters. In case of dispute:</p>
        <ol style={{ ...listStyle, listStyleType: 'decimal' }}>
          <li>Contact the other party directly through the platform.</li>
          <li>If unresolved within 48 hours, contact RentIt at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</li>
          <li>RentIt may mediate and, at its discretion, make a final determination on deposit release.</li>
        </ol>
        <p>RentIt's mediation decisions are final for matters within our platform scope, but do not affect your right to pursue legal remedies.</p>
      </Section>

      <Section title="10. Prohibited Conduct">
        <p>You may not:</p>
        <ul style={listStyle}>
          <li>Use RentIt for illegal purposes or to facilitate illegal activity</li>
          <li>Circumvent platform payments (arranging rentals off-platform to avoid fees)</li>
          <li>Post false, misleading, or fraudulent listings or reviews</li>
          <li>Harass, threaten, or discriminate against other users</li>
          <li>Attempt to access other users' accounts or data</li>
          <li>Scrape or extract data from the platform without written permission</li>
          <li>Use the platform if you have been previously banned</li>
        </ul>
        <p>Violations may result in immediate account suspension and legal action.</p>
      </Section>

      <Section title="11. Reviews and Content">
        <p>Users may leave reviews after completed rentals. Reviews must be honest, based on direct experience, and not defamatory. RentIt may remove reviews that violate these standards. By submitting content (reviews, photos, descriptions), you grant RentIt a non-exclusive licence to use that content on the platform.</p>
      </Section>

      <Section title="12. Intellectual Property">
        <p>The RentIt platform, logo, and software are owned by {COMPANY} and protected by Belgian and EU intellectual property law. You may not copy, modify, or distribute any part of the platform without written permission.</p>
      </Section>

      <Section title="13. Termination">
        <p>You may delete your account at any time through your Profile settings or by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Active bookings must be completed or cancelled before deletion.</p>
        <p>RentIt may terminate or suspend your account if you violate these Terms, with or without notice depending on the severity of the violation.</p>
      </Section>

      <Section title="14. Governing Law and Disputes">
        <p>These Terms are governed by <strong>{GOVERNING_LAW}</strong>. Any dispute arising from these Terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts of <strong>Brussels, Belgium</strong>.</p>
        <p>Before initiating legal proceedings, you agree to attempt to resolve any dispute with us informally by contacting <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We will endeavour to resolve disputes within 30 days.</p>
        <p>As a consumer in Belgium, you may also use the European Online Dispute Resolution platform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="15. Changes to These Terms">
        <p>We may update these Terms from time to time. We will notify you of material changes by email at least <strong>30 days</strong> before they take effect. Continued use of the platform after that date constitutes acceptance of the new Terms.</p>
      </Section>

      <Section title="16. Contact">
        <p>
          <strong>{COMPANY}</strong><br />
          {ADDRESS}<br />
          Legal: <a href={`mailto:${EMAIL}`}>{EMAIL}</a><br />
          Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </Section>
    </div>
  )
}

function TermsFR() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Conditions générales d'utilisation</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Dernière mise à jour : {LAST_UPDATED}</p>

      <div className="card" style={{ marginBottom: '24px', background: '#fff8e1', border: '1px solid #fde68a' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Important :</strong> En créant un compte ou en utilisant RentIt, vous acceptez ces Conditions. Veuillez les lire attentivement.
        </p>
      </div>

      <Section title="1. À propos de RentIt">
        <p>{COMPANY} est une marketplace peer-to-peer qui met en relation des personnes souhaitant louer des outils (« Locataires ») et des personnes qui les possèdent (« Propriétaires »). RentIt est un intermédiaire de plateforme — nous ne possédons, n'inspectons ni ne garantissons aucun article listé.</p>
      </Section>

      <Section title="2. Admissibilité">
        <ul style={listStyle}>
          <li>Vous devez avoir au moins <strong>18 ans</strong>.</li>
          <li>Vous devez fournir des informations d'inscription exactes et complètes.</li>
          <li>Un compte par personne.</li>
        </ul>
      </Section>

      <Section title="3. Paiements et frais">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Frais</Th>
              <Th>Montant</Th>
              <Th>Payé par</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Prix de location', 'Fixé par le Propriétaire', 'Locataire']} />
            <Tr data={['Dépôt de garantie', 'Fixé par le Propriétaire — remboursable', 'Locataire']} />
            <Tr data={['Frais d\'assurance', '3,00 € par jour', 'Locataire (couvre les dommages jusqu\'à 500 €)']} />
            <Tr data={['Commission plateforme', '12 % du prix de location', 'Déduit du versement au Propriétaire']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '10px', fontStyle: 'italic' }}>
          * Pendant la période bêta, la commission et les frais d'assurance sont offerts. Le tarif en vigueur est toujours affiché lors du paiement.
        </p>
      </Section>

      <Section title="4. Annulations et remboursements">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Annulé par</Th>
              <Th>Délai</Th>
              <Th>Remboursement</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Locataire', 'Plus de 48h avant le début', 'Remboursement 100 % location + dépôt']} />
            <Tr data={['Locataire', 'Moins de 48h avant le début', 'Remboursement 50 % location ; dépôt remboursé']} />
            <Tr data={['Locataire', 'Après le début de la location', 'Pas de remboursement pour les jours écoulés']} />
            <Tr data={['Propriétaire', 'À tout moment avant le début', 'Remboursement 100 % au Locataire']} />
          </tbody>
        </table>
      </Section>

      <Section title="5. Droit applicable">
        <p>Les présentes CGU sont régies par le <strong>droit belge</strong>. Tout litige relève de la compétence exclusive des tribunaux de <strong>Bruxelles, Belgique</strong>. Résolution en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="6. Contact">
        <p><strong>{COMPANY}</strong> — {ADDRESS}<br />
          Juridique : <a href={`mailto:${EMAIL}`}>{EMAIL}</a> | Support : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </Section>
    </div>
  )
}

function TermsNL() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Algemene voorwaarden</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Laatste update: {LAST_UPDATED}</p>

      <div className="card" style={{ marginBottom: '24px', background: '#fff8e1', border: '1px solid #fde68a' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Belangrijk:</strong> Door een account aan te maken of RentIt te gebruiken, gaat u akkoord met deze Voorwaarden.
        </p>
      </div>

      <Section title="1. Over RentIt">
        <p>{COMPANY} exploiteert een peer-to-peer marktplaats die mensen die gereedschap willen huren ("Huurders") verbindt met eigenaren ("Verhuurders"). RentIt is een platform-intermediair — wij bezitten, inspecteren of garanderen geen geadverteerde items.</p>
      </Section>

      <Section title="2. Toelating">
        <ul style={listStyle}>
          <li>U moet minimaal <strong>18 jaar</strong> oud zijn.</li>
          <li>U moet nauwkeurige registratiegegevens verstrekken.</li>
          <li>Één account per persoon.</li>
        </ul>
      </Section>

      <Section title="3. Betalingen en kosten">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Kosten</Th>
              <Th>Bedrag</Th>
              <Th>Betaald door</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Huurprijs', 'Vastgesteld door Verhuurder', 'Huurder']} />
            <Tr data={['Borg (indien van toepassing)', 'Vastgesteld door Verhuurder — terugbetaalbaar', 'Huurder']} />
            <Tr data={['Verzekeringsbijdrage', '€ 3,00 per dag', 'Huurder (dekt schade tot € 500)']} />
            <Tr data={['Platformcommissie', '12% van de huurprijs', 'Ingehouden op uitbetaling Verhuurder']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '10px', fontStyle: 'italic' }}>
          * Tijdens de bètaperiode worden commissie en verzekeringkosten niet in rekening gebracht. De actuele prijzen worden altijd getoond bij het afrekenen.
        </p>
      </Section>

      <Section title="4. Annuleringen en terugbetalingen">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Geannuleerd door</Th>
              <Th>Tijdstip</Th>
              <Th>Terugbetaling</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Huurder', 'Meer dan 48u voor aanvang', '100% huur + borg terugbetaald']} />
            <Tr data={['Huurder', 'Minder dan 48u voor aanvang', '50% huur; borg terugbetaald']} />
            <Tr data={['Huurder', 'Na aanvang verhuur', 'Geen terugbetaling voor verstreken dagen']} />
            <Tr data={['Verhuurder', 'Voor aanvang', '100% terugbetaling aan Huurder']} />
          </tbody>
        </table>
      </Section>

      <Section title="5. Toepasselijk recht">
        <p>Deze Voorwaarden zijn onderworpen aan het <strong>Belgisch recht</strong>. Geschillen vallen onder de exclusieve bevoegdheid van de rechtbanken van <strong>Brussel, België</strong>. Online geschillenbeslechting: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="6. Contact">
        <p><strong>{COMPANY}</strong> — {ADDRESS}<br />
          Juridisch: <a href={`mailto:${EMAIL}`}>{EMAIL}</a> | Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </Section>
    </div>
  )
}

// Helpers
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>{title}</h2>
      <div style={{ lineHeight: '1.7', color: '#333' }}>{children}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', fontSize: '13px', color: '#555', borderBottom: '1px solid #e0e0e0' }}>{children}</th>
}

function Tr({ data }: { data: string[] }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      {data.map((d, i) => (
        <td key={i} style={{ padding: '8px 12px', fontSize: '13px', verticalAlign: 'top' }}>{d}</td>
      ))}
    </tr>
  )
}

const listStyle: React.CSSProperties = {
  paddingLeft: '20px',
  lineHeight: '2',
  marginBottom: '12px',
}