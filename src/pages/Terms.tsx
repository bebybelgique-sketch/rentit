import React, { useState } from 'react'

type Lang = 'en' | 'fr' | 'nl'

// Дата правится ВМЕСТЕ с текстом документа. 11.08 оба документа были
// переписаны по существу (убраны страховка, Stripe, раздел платежей,
// перенумерованы разделы), а дата осталась мартовской — при том что
// сама политика обещает: «The \"Last updated\" date at the top of this
// page will always reflect the most recent version».
//
// По языкам раздельно: строка показывается в трёх разделах, и
// английское «March 20, 2026» стояло под французским «Dernière mise
// à jour :» и нидерландским «Laatste update:».
const LAST_UPDATED_EN = 'August 11, 2026'
const LAST_UPDATED_FR = '11 août 2026'
const LAST_UPDATED_NL = '11 augustus 2026'
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
      <p style={{ color: '#666', marginBottom: '32px' }}>Last updated: {LAST_UPDATED_EN}</p>

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

      <Section title="6. Payments Between Users">
        <p><strong>No payment goes through RentIt.</strong> The rental price and any deposit are agreed and settled <strong>directly between the Renter and the Owner</strong>, in cash, at handover. RentIt holds no funds, processes no cards, and takes no commission.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Amount</Th>
              <Th>Set by</Th>
              <Th>Settled</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Rental price', 'Owner, shown on the listing', 'Between the parties, at handover']} />
            <Tr data={['Deposit (if any)', 'Owner, shown on the listing', 'Between the parties, returned at the end']} />
          </tbody>
        </table>

        <ul style={listStyle}>
          <li>Amounts shown on the platform are <strong>indicative</strong>: they reflect what the Owner published, not a sum collected by RentIt.</li>
          <li>RentIt is not a payment service provider and does not intervene in the settlement.</li>
          <li><strong>Using the platform is currently free.</strong> This may change: if paid features are introduced, users will be informed in advance and no charge will ever be applied without prior consent.</li>
        </ul>
      </Section>

      <Section title="7. Cancellations">
        <p>Either party may cancel before the item changes hands. The cancellation is recorded with its author, its date and its reason, and the other party is notified by email.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Booking status</Th>
              <Th>Who may cancel</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Awaiting approval', 'The Renter (the Owner declines instead)']} />
            <Tr data={['Confirmed, item not yet handed over', 'Either party']} />
            <Tr data={['In progress (item handed over)', 'Neither — the rental ends with the return']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666' }}>
          Since RentIt never holds your money, there is nothing for RentIt to refund. Any sum already exchanged is settled between the parties.
        </p>
      </Section>

      <Section title="8. Liability">
        <p><strong>RentIt provides no insurance.</strong> There is no damage cover, no guarantee fund and no compensation scheme. The item is lent between private individuals, under their own responsibility.</p>
        <ul style={listStyle}>
          <li>The Renter is liable to the Owner for damage, loss or theft of the item.</li>
          <li>The Owner is responsible for the item being safe and fit for its stated use.</li>
          <li>Both parties are strongly advised to <strong>photograph the item at handover and at return</strong> — the platform provides this for each booking, and the photos remain visible to both.</li>
          <li>Check whether your home insurance (<em>responsabilité civile familiale</em>) covers this type of loan.</li>
        </ul>
        <p><strong>RentIt is not a party to the rental agreement.</strong> Its role is limited to putting people in touch and hosting their exchanges. RentIt is not liable for: the condition or quality of items, loss of earnings, consequential or indirect damages, or disputes between users.</p>
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
      <p style={{ color: '#666', marginBottom: '32px' }}>Dernière mise à jour : {LAST_UPDATED_FR}</p>

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

      <Section title="3. Paiements entre utilisateurs">
        <p><strong>Aucun paiement ne transite par RentIt.</strong> Le prix de la location et l'éventuel dépôt de garantie sont convenus et réglés <strong>directement entre le Locataire et le Propriétaire</strong>, en espèces, lors de la remise. RentIt ne détient aucun fonds, ne traite aucune carte et ne prélève aucune commission.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Montant</Th>
              <Th>Fixé par</Th>
              <Th>Réglé</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Prix de location', "Le Propriétaire, affiché sur l'annonce", 'Entre les parties, à la remise']} />
            <Tr data={['Dépôt de garantie (le cas échéant)', "Le Propriétaire, affiché sur l'annonce", 'Entre les parties, restitué à la fin']} />
          </tbody>
        </table>

        <ul style={listStyle}>
          <li>Les montants affichés sur la plateforme sont <strong>indicatifs</strong> : ils reprennent ce que le Propriétaire a publié, et non une somme encaissée par RentIt.</li>
          <li>RentIt n'est pas un prestataire de services de paiement et n'intervient pas dans le règlement.</li>
          <li><strong>L'utilisation de la plateforme est actuellement gratuite.</strong> Cela peut évoluer : si des fonctionnalités payantes sont introduites, les utilisateurs en seront informés à l'avance et aucun montant ne sera jamais prélevé sans accord préalable.</li>
        </ul>
      </Section>

      <Section title="4. Annulations">
        <p>Chaque partie peut annuler tant que l'outil n'a pas changé de mains. L'annulation est enregistrée avec son auteur, sa date et son motif, et l'autre partie en est informée par e-mail.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Statut de la réservation</Th>
              <Th>Qui peut annuler</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={["En attente d'approbation", 'Le Locataire (le Propriétaire refuse la demande)']} />
            <Tr data={['Confirmée, outil pas encore remis', "L'une ou l'autre partie"]} />
            <Tr data={['En cours (outil remis)', 'Personne — la location se termine par le retour']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666' }}>
          RentIt ne détenant jamais votre argent, RentIt n'a rien à rembourser. Toute somme déjà échangée se règle entre les parties.
        </p>
      </Section>

      <Section title="5. Responsabilité">
        <p><strong>RentIt ne fournit aucune assurance.</strong> Il n'existe ni couverture des dommages, ni fonds de garantie, ni indemnisation. L'outil est prêté entre particuliers, sous leur propre responsabilité.</p>
        <ul style={listStyle}>
          <li>Le Locataire répond envers le Propriétaire des dommages, de la perte ou du vol de l'outil.</li>
          <li>Le Propriétaire répond de la sécurité de l'outil et de son aptitude à l'usage annoncé.</li>
          <li>Il est vivement conseillé aux deux parties de <strong>photographier l'outil à la remise et au retour</strong> — la plateforme le permet pour chaque réservation, et les photos restent visibles des deux côtés.</li>
          <li>Vérifiez si votre assurance <em>responsabilité civile familiale</em> couvre ce type de prêt.</li>
        </ul>
        <p><strong>RentIt n'est pas partie au contrat de location.</strong> Son rôle se limite à mettre les personnes en relation et à héberger leurs échanges. RentIt n'est pas responsable de l'état ou de la qualité des outils, des pertes de revenus, des dommages indirects, ni des litiges entre utilisateurs.</p>
      </Section>

      <Section title="6. Droit applicable">
        <p>Les présentes CGU sont régies par le <strong>droit belge</strong>. Tout litige relève de la compétence exclusive des tribunaux de <strong>Bruxelles, Belgique</strong>. Résolution en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="7. Contact">
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
      <p style={{ color: '#666', marginBottom: '32px' }}>Laatste update: {LAST_UPDATED_NL}</p>

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

      <Section title="3. Betalingen tussen gebruikers">
        <p><strong>Er verloopt geen enkele betaling via RentIt.</strong> De huurprijs en een eventuele borg worden <strong>rechtstreeks tussen Huurder en Verhuurder</strong> afgesproken en contant betaald bij de overhandiging. RentIt houdt geen geld aan, verwerkt geen kaarten en neemt geen commissie.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Bedrag</Th>
              <Th>Vastgesteld door</Th>
              <Th>Betaald</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Huurprijs', 'Verhuurder, vermeld in de advertentie', 'Tussen partijen, bij de overhandiging']} />
            <Tr data={['Borg (indien van toepassing)', 'Verhuurder, vermeld in de advertentie', 'Tussen partijen, terug bij afloop']} />
          </tbody>
        </table>

        <ul style={listStyle}>
          <li>De op het platform getoonde bedragen zijn <strong>indicatief</strong>: ze geven weer wat de Verhuurder heeft gepubliceerd, niet een som die RentIt int.</li>
          <li>RentIt is geen betaaldienstverlener en komt niet tussen bij de afrekening.</li>
          <li><strong>Het gebruik van het platform is momenteel gratis.</strong> Dit kan veranderen: als betalende functies worden ingevoerd, worden gebruikers vooraf geïnformeerd en wordt nooit een bedrag aangerekend zonder voorafgaande toestemming.</li>
        </ul>
      </Section>

      <Section title="4. Annuleringen">
        <p>Elke partij kan annuleren zolang het gereedschap niet is overhandigd. De annulering wordt vastgelegd met auteur, datum en reden, en de andere partij wordt per e-mail verwittigd.</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Status van de reservering</Th>
              <Th>Wie kan annuleren</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['In afwachting van goedkeuring', 'De Huurder (de Verhuurder weigert de aanvraag)']} />
            <Tr data={['Bevestigd, gereedschap nog niet overhandigd', 'Beide partijen']} />
            <Tr data={['Lopend (gereedschap overhandigd)', 'Niemand — de verhuur eindigt met de teruggave']} />
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666' }}>
          Omdat RentIt nooit uw geld aanhoudt, heeft RentIt niets terug te betalen. Reeds uitgewisselde bedragen worden tussen de partijen geregeld.
        </p>
      </Section>

      <Section title="5. Aansprakelijkheid">
        <p><strong>RentIt biedt geen verzekering.</strong> Er is geen schadedekking, geen waarborgfonds en geen vergoedingsregeling. Het gereedschap wordt tussen particulieren uitgeleend, onder hun eigen verantwoordelijkheid.</p>
        <ul style={listStyle}>
          <li>De Huurder is tegenover de Verhuurder aansprakelijk voor schade, verlies of diefstal van het gereedschap.</li>
          <li>De Verhuurder staat in voor de veiligheid van het gereedschap en de geschiktheid voor het aangekondigde gebruik.</li>
          <li>Beide partijen wordt sterk aangeraden het gereedschap <strong>te fotograferen bij de overhandiging en bij de teruggave</strong> — het platform voorziet dit per reservering, en de foto's blijven voor beide zichtbaar.</li>
          <li>Ga na of uw <em>familiale burgerlijke aansprakelijkheidsverzekering</em> dit soort uitlening dekt.</li>
        </ul>
        <p><strong>RentIt is geen partij bij de huurovereenkomst.</strong> De rol beperkt zich tot het in contact brengen van mensen en het hosten van hun uitwisselingen. RentIt is niet aansprakelijk voor de staat of kwaliteit van het gereedschap, gederfde inkomsten, indirecte schade of geschillen tussen gebruikers.</p>
      </Section>

      <Section title="6. Toepasselijk recht">
        <p>Deze Voorwaarden zijn onderworpen aan het <strong>Belgisch recht</strong>. Geschillen vallen onder de exclusieve bevoegdheid van de rechtbanken van <strong>Brussel, België</strong>. Online geschillenbeslechting: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="7. Contact">
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