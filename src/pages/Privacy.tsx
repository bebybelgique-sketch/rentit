import React from 'react'
import { useDocumentLanguage } from '../hooks/useDocumentLanguage'
import {
  PLATFORM_NAME, OPERATOR_NAME, OPERATOR_ADDRESS, OPERATOR_STATUS, CONTACT_EMAIL,
} from '../domain/operator'

// Дата правится ВМЕСТЕ с текстом документа. 11.08 оба документа были
// переписаны по существу (убраны страховка, Stripe, раздел платежей,
// перенумерованы разделы), а дата осталась мартовской — при том что
// сама политика обещает: «The \"Last updated\" date at the top of this
// page will always reflect the most recent version».
//
// По языкам раздельно: строка показывается в трёх разделах, и
// английское «March 20, 2026» стояло под французским «Dernière mise
// à jour :» и нидерландским «Laatste update:».
const LAST_UPDATED_EN = 'August 14, 2026'
const LAST_UPDATED_FR = '14 août 2026'
const LAST_UPDATED_NL = '14 augustus 2026'
// Ответственный за обработку — физическое лицо, а не «RentIt». До 14.08
// здесь стояли COMPANY = 'RentIt', ADDRESS = 'Belgium' и ящик
// privacy@rentit.be: контроллер вымышлен, страна вместо адреса, а домен
// rentit.be принадлежит постороннему лицу — то есть запросы по GDPR
// уходили к чужому человеку. Значения теперь общие с письмами.
const COMPANY = PLATFORM_NAME
const EMAIL = CONTACT_EMAIL
const ADDRESS = `${OPERATOR_NAME}, ${OPERATOR_ADDRESS}`
const DPA_URL = 'https://www.dataprotectionauthority.be'

export default function PrivacyPolicy() {
  const lang = useDocumentLanguage()

  return (
    <div className="page">
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {lang === 'en' && <PrivacyEN />}
        {lang === 'fr' && <PrivacyFR />}
        {lang === 'nl' && <PrivacyNL />}

      </div>
    </div>
  )
}

function PrivacyEN() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Last updated: {LAST_UPDATED_EN}</p>

      <div className="card" style={{ marginBottom: '24px', background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Summary:</strong> RentIt collects only the data necessary to provide our peer-to-peer tool rental service.
          We do not sell your data. We do not use tracking cookies. You can request deletion of your data at any time by emailing <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </div>

      <Section title="1. Who We Are">
        <p>{COMPANY} is a peer-to-peer marketplace for renting tools and equipment in Belgium. It is operated by <strong>{OPERATOR_NAME}</strong>, a {OPERATOR_STATUS.en} established in Belgium, who is the data controller responsible for your personal data.</p>
        <p><strong>Contact:</strong> {OPERATOR_NAME}, {OPERATOR_ADDRESS} — <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
      </Section>

      <Section title="2. Data We Collect and Why">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Data</Th>
              <Th>Why we collect it</Th>
              <Th>Legal basis (GDPR Art. 6)</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Full name, email address', 'Create and manage your account', 'Art. 6(1)(b) — contract performance']} />
            <Tr data={['Phone number', 'Identity verification (OTP), contact between renters and owners after confirmed booking', 'Art. 6(1)(b) — contract performance']} />
            <Tr data={['Geolocation (optional)', 'Show nearby items on the map; stored only if you grant permission', 'Art. 6(1)(a) — your consent']} />
            <Tr data={['Listing photos', 'Display your items to other users', 'Art. 6(1)(b) — contract performance']} />
            <Tr data={['Booking history', 'Show each party their bookings and open mutual reviews once the rental is complete', 'Art. 6(1)(b) — contract performance']} />
            <Tr data={['Ratings and reviews', 'Build trust in the community', 'Art. 6(1)(f) — legitimate interest']} />
            <Tr data={['Referral code', 'Track who invited whom', 'Art. 6(1)(f) — legitimate interest']} />
            <Tr data={['Session cookie (Supabase auth)', 'Keep you logged in — functional cookies only, no tracking', 'Art. 6(1)(b) — necessary for service']} />
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
          We do <strong>not</strong> collect: sensitive personal data (health, ethnicity, religion), data from minors under 18, or any data beyond what is listed above.
        </p>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul style={listStyle}>
          <li>Provide and improve the RentIt platform</li>
          <li>Process bookings — no payment passes through RentIt, settlement is in cash between users</li>
          <li>Send transactional emails about your bookings (request, approval, cancellation, expiry) — not marketing without your consent</li>
          <li>Verify your identity via phone OTP</li>
          <li>Resolve disputes between renters and owners</li>
          <li>Comply with legal obligations (Belgian Law of 30 July 2018, GDPR)</li>
        </ul>
        <p>We do <strong>not</strong> use your data for automated decision-making or profiling that produces legal or significant effects on you.</p>
      </Section>

      <Section title="4. Who We Share Data With">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Recipient</Th>
              <Th>Purpose</Th>
              <Th>Location</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Supabase Inc.', 'Database and authentication hosting', 'EU region (Frankfurt)']} />
            <Tr data={['Resend Inc.', 'Transactional email delivery', 'USA — Standard Contractual Clauses apply']} />
            <Tr data={['Other RentIt users', 'Name and phone number shared with the other party only after a booking is confirmed', 'Belgium']} />
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>
          We do <strong>not</strong> sell, rent, or share your personal data with advertisers or data brokers.
          We do not transfer data to third countries except as noted above, and only with appropriate safeguards (Standard Contractual Clauses per GDPR Art. 46).
        </p>
      </Section>

      <Section title="5. How Long We Keep Your Data">
        <ul style={listStyle}>
          <li><strong>Account data:</strong> kept while your account is active and <strong>deleted immediately</strong> when you delete it. Your past bookings remain, stripped of any link to you, for the 7 years below.</li>
          <li><strong>Booking records:</strong> 7 years (Belgian accounting and tax law requirements)</li>
          <li><strong>Photos:</strong> deleted within 30 days of listing removal</li>
          <li><strong>Session cookies:</strong> expire when you log out or after 7 days of inactivity</li>
        </ul>
      </Section>

      <Section title="6. Your Rights Under GDPR">
        <p>Under GDPR Articles 15–22 and the Belgian Law of 30 July 2018, you have the right to:</p>
        <ul style={listStyle}>
          <li><strong>Access</strong> — request a copy of all personal data we hold about you</li>
          <li><strong>Rectification</strong> — correct inaccurate data in your profile</li>
          <li><strong>Erasure ("right to be forgotten")</strong> — request deletion of your account and data</li>
          <li><strong>Restriction</strong> — ask us to temporarily stop processing your data</li>
          <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
          <li><strong>Object</strong> — object to processing based on legitimate interest</li>
          <li><strong>Withdraw consent</strong> — for geolocation data, withdraw at any time without penalty</li>
        </ul>
        <p>To exercise any right, email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We will respond within <strong>30 days</strong> as required by GDPR Art. 12.</p>
        <p>If you believe we have violated your rights, you may lodge a complaint with the <strong>Belgian Data Protection Authority (APD/GBA)</strong>:</p>
        <p><a href={DPA_URL} target="_blank" rel="noopener noreferrer">{DPA_URL}</a> — contact@apd-gba.be — +32 2 274 48 00</p>
      </Section>

      <Section title="7. Cookies">
        <p>RentIt uses <strong>only one functional cookie</strong>: a Supabase authentication session cookie required for you to remain logged in. This cookie:</p>
        <ul style={listStyle}>
          <li>Does not track your behaviour across websites</li>
          <li>Is not shared with third parties for advertising</li>
          <li>Is classified as "strictly necessary" under the ePrivacy Directive — no consent banner is required</li>
        </ul>
        <p>If we add analytics or marketing cookies in the future, we will update this policy and implement a consent mechanism before doing so.</p>
      </Section>

      <Section title="8. Data Security">
        <p>We implement appropriate technical and organisational measures including:</p>
        <ul style={listStyle}>
          <li>TLS encryption for all data in transit</li>
          <li>Row-Level Security (RLS) — each user can only access their own data</li>
          <li>We never see, ask for or store bank or card details — no payment goes through the platform</li>
          <li>Access to production data limited to authorised personnel only</li>
        </ul>
        <p>In the event of a data breach that risks your rights or freedoms, we will notify the Belgian DPA within <strong>72 hours</strong> and inform affected users without undue delay, as required by GDPR Art. 33–34.</p>
      </Section>

      <Section title="9. Children">
        <p>RentIt is not intended for users under 18 years of age. We do not knowingly collect data from minors. If you believe a minor has created an account, please contact us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a> and we will delete the account promptly.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by a prominent notice on the platform at least 30 days before changes take effect. The "Last updated" date at the top of this page will always reflect the most recent version.</p>
      </Section>

      <Section title="11. Contact">
        <p>For any privacy-related questions or requests:<br />
          <strong>{COMPANY}</strong><br />
          {ADDRESS}<br />
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      </Section>
    </div>
  )
}

function PrivacyFR() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Politique de confidentialité</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Dernière mise à jour : {LAST_UPDATED_FR}</p>

      <div className="card" style={{ marginBottom: '24px', background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Résumé :</strong> RentIt ne collecte que les données nécessaires à la fourniture de notre service de location entre particuliers. Nous ne vendons pas vos données. Nous n'utilisons pas de cookies de suivi. Vous pouvez demander la suppression de vos données à tout moment en écrivant à <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </div>

      <Section title="1. Qui sommes-nous ?">
        <p>{COMPANY} est une marketplace de location d'outils et d'équipements entre particuliers en Belgique. La plateforme est exploitée par <strong>{OPERATOR_NAME}</strong>, {OPERATOR_STATUS.fr} établie en Belgique, responsable du traitement de vos données personnelles.</p>
        <p><strong>Contact :</strong> {OPERATOR_NAME}, {OPERATOR_ADDRESS} — <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
      </Section>

      <Section title="2. Données collectées et finalités">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Donnée</Th>
              <Th>Finalité</Th>
              <Th>Base légale (RGPD Art. 6)</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Nom complet, adresse email', 'Créer et gérer votre compte', 'Art. 6(1)(b) — exécution du contrat']} />
            <Tr data={['Numéro de téléphone', "Vérification d'identité (OTP), contact entre locataires et propriétaires après réservation confirmée", 'Art. 6(1)(b) — exécution du contrat']} />
            <Tr data={['Géolocalisation (optionnelle)', "Afficher les articles à proximité ; stockée uniquement si vous l'autorisez", 'Art. 6(1)(a) — votre consentement']} />
            <Tr data={["Photos d'annonces", 'Présenter vos articles aux autres utilisateurs', 'Art. 6(1)(b) — exécution du contrat']} />
            <Tr data={['Historique de réservations', 'Montrer à chaque partie ses réservations et ouvrir les avis mutuels une fois la location terminée', 'Art. 6(1)(b) — exécution du contrat']} />
            <Tr data={['Notes et avis', 'Renforcer la confiance dans la communauté', 'Art. 6(1)(f) — intérêt légitime']} />
            <Tr data={['Code de parrainage', 'Suivi de qui a invité qui', 'Art. 6(1)(f) — intérêt légitime']} />
            <Tr data={['Cookie de session (Supabase auth)', 'Maintenir votre connexion — cookie fonctionnel uniquement, sans traçage', 'Art. 6(1)(b) — nécessaire au service']} />
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
          Nous ne collectons <strong>pas</strong> : données sensibles (santé, origine ethnique, religion), données de mineurs de moins de 18 ans, ni aucune autre donnée au-delà de ce qui est listé ci-dessus.
        </p>
      </Section>

      <Section title="3. Utilisation de vos données">
        <ul style={listStyle}>
          <li>Fournir et améliorer la plateforme RentIt</li>
          <li>Traiter les réservations — aucun paiement ne transite par RentIt, le règlement se fait en espèces entre utilisateurs</li>
          <li>Envoyer des emails transactionnels liés à vos réservations (demande, approbation, annulation, expiration) — pas de marketing sans votre consentement</li>
          <li>Vérifier votre identité via OTP téléphonique</li>
          <li>Résoudre les litiges entre locataires et propriétaires</li>
          <li>Respecter nos obligations légales (Loi belge du 30 juillet 2018, RGPD)</li>
        </ul>
        <p>Nous n'utilisons <strong>pas</strong> vos données pour des décisions automatisées ou un profilage produisant des effets juridiques ou significatifs sur vous.</p>
      </Section>

      <Section title="4. Partage de données">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Destinataire</Th>
              <Th>Finalité</Th>
              <Th>Localisation</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Supabase Inc.', 'Hébergement base de données et authentification', 'UE (Francfort)']} />
            <Tr data={['Resend Inc.', "Envoi d'emails transactionnels", 'USA — Clauses Contractuelles Types applicables']} />
            <Tr data={['Autres utilisateurs RentIt', 'Nom et téléphone partagés avec l\'autre partie uniquement après confirmation de réservation', 'Belgique']} />
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>
          Nous ne vendons, ne louons ni ne partageons vos données avec des annonceurs ou des courtiers en données.
          Nous ne transférons pas de données hors UE sauf dans les cas indiqués ci-dessus, et uniquement avec des garanties appropriées (Clauses Contractuelles Types, RGPD Art. 46).
        </p>
      </Section>

      <Section title="5. Durée de conservation">
        <ul style={listStyle}>
          <li><strong>Données de compte :</strong> conservées tant que le compte est actif et <strong>supprimées immédiatement</strong> à votre demande. Vos réservations passées subsistent, détachées de votre identité, pendant les 7 ans indiqués ci-dessous.</li>
          <li><strong>Réservations :</strong> 7 ans (obligations comptables et fiscales belges)</li>
          <li><strong>Photos :</strong> supprimées dans les 30 jours suivant le retrait de l'annonce</li>
          <li><strong>Cookies de session :</strong> expirent à la déconnexion ou après 7 jours d'inactivité</li>
        </ul>
      </Section>

      <Section title="6. Vos droits (RGPD Art. 15–22)">
        <p>Conformément aux articles 15 à 22 du RGPD et à la Loi belge du 30 juillet 2018, vous disposez du droit :</p>
        <ul style={listStyle}>
          <li><strong>d'accès</strong> — obtenir une copie de toutes les données personnelles que nous détenons sur vous</li>
          <li><strong>de rectification</strong> — corriger des données inexactes dans votre profil</li>
          <li><strong>d'effacement (« droit à l'oubli »)</strong> — demander la suppression de votre compte et de vos données</li>
          <li><strong>de limitation</strong> — nous demander de cesser temporairement le traitement de vos données</li>
          <li><strong>de portabilité</strong> — recevoir vos données dans un format lisible par machine</li>
          <li><strong>d'opposition</strong> — vous opposer au traitement fondé sur un intérêt légitime</li>
          <li><strong>de retirer votre consentement</strong> — pour la géolocalisation, à tout moment et sans pénalité</li>
        </ul>
        <p>Pour exercer ces droits : <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Réponse dans les <strong>30 jours</strong> (RGPD Art. 12).</p>
        <p>Réclamation auprès de l'<strong>Autorité de protection des données (APD/GBA)</strong> :<br />
          <a href={DPA_URL} target="_blank" rel="noopener noreferrer">{DPA_URL}</a> — contact@apd-gba.be — +32 2 274 48 00
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>RentIt utilise <strong>un seul cookie fonctionnel</strong> : un cookie de session d'authentification Supabase nécessaire pour maintenir votre connexion. Ce cookie :</p>
        <ul style={listStyle}>
          <li>Ne suit pas votre comportement sur d'autres sites</li>
          <li>N'est pas partagé avec des tiers à des fins publicitaires</li>
          <li>Est classé comme « strictement nécessaire » au titre de la directive ePrivacy — aucune bannière de consentement n'est requise</li>
        </ul>
        <p>Si nous ajoutons des cookies d'analyse ou marketing à l'avenir, nous mettrons à jour cette politique et mettrons en place un mécanisme de consentement avant de le faire.</p>
      </Section>

      <Section title="8. Sécurité des données">
        <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées, notamment :</p>
        <ul style={listStyle}>
          <li>Chiffrement TLS pour toutes les données en transit</li>
          <li>Sécurité au niveau des lignes (RLS) — chaque utilisateur ne peut accéder qu'à ses propres données</li>
          <li>Nous ne voyons, ne demandons ni ne conservons aucune coordonnée bancaire — aucun paiement ne transite par la plateforme</li>
          <li>Accès aux données de production limité au personnel autorisé</li>
        </ul>
        <p>En cas de violation de données présentant un risque pour vos droits ou libertés, nous notifierons l'APD/GBA dans les <strong>72 heures</strong> et informerons les utilisateurs concernés sans délai injustifié (RGPD Art. 33–34).</p>
      </Section>

      <Section title="9. Mineurs">
        <p>RentIt n'est pas destiné aux utilisateurs de moins de 18 ans. Nous ne collectons pas sciemment de données auprès de mineurs. Si vous pensez qu'un mineur a créé un compte, contactez-nous à <a href={`mailto:${EMAIL}`}>{EMAIL}</a> et nous supprimerons le compte rapidement.</p>
      </Section>

      <Section title="10. Modifications de cette politique">
        <p>Nous pouvons mettre à jour cette Politique de confidentialité de temps à autre. Nous vous informerons des modifications importantes par email ou par un avis bien visible sur la plateforme au moins 30 jours avant leur entrée en vigueur. La date de « Dernière mise à jour » en haut de cette page reflète toujours la version la plus récente.</p>
      </Section>

      <Section title="11. Contact">
        <p><strong>{COMPANY}</strong><br />
          {ADDRESS}<br />
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      </Section>
    </div>
  )
}

function PrivacyNL() {
  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Privacybeleid</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Laatste update: {LAST_UPDATED_NL}</p>

      <div className="card" style={{ marginBottom: '24px', background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <strong>Samenvatting:</strong> RentIt verzamelt alleen gegevens die nodig zijn voor onze peer-to-peer verhuurservice. Wij verkopen uw gegevens niet. Wij gebruiken geen tracking cookies. U kunt te allen tijde verwijdering van uw gegevens aanvragen via <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </div>

      <Section title="1. Wie zijn wij?">
        <p>{COMPANY} is een peer-to-peer marktplaats voor de verhuur van gereedschap en apparatuur in België. Het platform wordt uitgebaat door <strong>{OPERATOR_NAME}</strong>, {OPERATOR_STATUS.nl} gevestigd in België, verwerkingsverantwoordelijke voor uw persoonsgegevens.</p>
        <p><strong>Contact:</strong> {OPERATOR_NAME}, {OPERATOR_ADDRESS} — <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
      </Section>

      <Section title="2. Gegevens die wij verzamelen en waarom">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Gegeven</Th>
              <Th>Doel</Th>
              <Th>Rechtsgrond (AVG Art. 6)</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Volledige naam, e-mailadres', 'Account aanmaken en beheren', 'Art. 6(1)(b) — uitvoering overeenkomst']} />
            <Tr data={['Telefoonnummer', 'Identiteitsverificatie (OTP), contact tussen huurders en verhuurders na bevestigde boeking', 'Art. 6(1)(b) — uitvoering overeenkomst']} />
            <Tr data={['Geolocatie (optioneel)', 'Nabijgelegen items tonen; alleen opgeslagen met uw toestemming', 'Art. 6(1)(a) — uw toestemming']} />
            <Tr data={["Advertentiefoto's", 'Uw items tonen aan andere gebruikers', 'Art. 6(1)(b) — uitvoering overeenkomst']} />
            <Tr data={['Boekingsgeschiedenis', 'Elke partij haar reserveringen tonen en na afloop de wederzijdse beoordelingen openen', 'Art. 6(1)(b) — uitvoering overeenkomst']} />
            <Tr data={['Beoordelingen', 'Vertrouwen opbouwen in de community', 'Art. 6(1)(f) — gerechtvaardigd belang']} />
            <Tr data={['Referralcode', 'Bijhouden wie wie heeft uitgenodigd', 'Art. 6(1)(f) — gerechtvaardigd belang']} />
            <Tr data={['Sessiecookie (Supabase auth)', 'U ingelogd houden — functionele cookie, geen tracking', 'Art. 6(1)(b) — noodzakelijk voor de dienst']} />
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
          Wij verzamelen <strong>geen</strong>: gevoelige persoonsgegevens (gezondheid, etniciteit, religie), gegevens van minderjarigen onder 18 jaar, of enige andere gegevens buiten bovenstaande lijst.
        </p>
      </Section>

      <Section title="3. Hoe wij uw gegevens gebruiken">
        <ul style={listStyle}>
          <li>Het leveren en verbeteren van het RentIt-platform</li>
          <li>Reserveringen verwerken — Er verloopt geen enkele betaling via RentIt, de afrekening gebeurt contant tussen gebruikers</li>
          <li>Transactionele e-mails over uw reserveringen versturen (aanvraag, goedkeuring, annulering, verval) — geen marketing zonder uw toestemming</li>
          <li>Het verifiëren van uw identiteit via telefoon-OTP</li>
          <li>Het oplossen van geschillen tussen huurders en verhuurders</li>
          <li>Het naleven van wettelijke verplichtingen (Belgische Wet van 30 juli 2018, AVG)</li>
        </ul>
        <p>Wij gebruiken uw gegevens <strong>niet</strong> voor geautomatiseerde besluitvorming of profilering die juridische of significante gevolgen voor u heeft.</p>
      </Section>

      <Section title="4. Met wie delen wij gegevens?">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <Th>Ontvanger</Th>
              <Th>Doel</Th>
              <Th>Locatie</Th>
            </tr>
          </thead>
          <tbody>
            <Tr data={['Supabase Inc.', 'Database- en authenticatiehosting', 'EU (Frankfurt)']} />
            <Tr data={['Resend Inc.', 'Transactionele e-mailbezorging', 'VS — Standaardcontractbepalingen van toepassing']} />
            <Tr data={['Andere RentIt-gebruikers', 'Naam en telefoon gedeeld met de andere partij alleen na bevestigde boeking', 'België']} />
          </tbody>
        </table>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>
          Wij verkopen, verhuren of delen uw persoonsgegevens niet met adverteerders of datamakelaars.
          Wij dragen geen gegevens over buiten de EU, behalve zoals hierboven vermeld, en alleen met passende waarborgen (Standaardcontractbepalingen, AVG Art. 46).
        </p>
      </Section>

      <Section title="5. Bewaartermijnen">
        <ul style={listStyle}>
          <li><strong>Accountgegevens:</strong> bewaard zolang het account actief is en <strong>onmiddellijk verwijderd</strong> op uw verzoek. Uw eerdere reserveringen blijven bestaan, losgekoppeld van uw identiteit, gedurende de 7 jaar hieronder.</li>
          <li><strong>Boekingsrecords:</strong> 7 jaar (Belgische boekhoudkundige en fiscale verplichting)</li>
          <li><strong>Foto's:</strong> verwijderd binnen 30 dagen na verwijdering van de advertentie</li>
          <li><strong>Sessiecookies:</strong> verlopen bij uitloggen of na 7 dagen inactiviteit</li>
        </ul>
      </Section>

      <Section title="6. Uw rechten onder de AVG">
        <p>Op grond van AVG Artikelen 15–22 en de Belgische Wet van 30 juli 2018 heeft u het recht op:</p>
        <ul style={listStyle}>
          <li><strong>Inzage</strong> — een kopie opvragen van alle persoonsgegevens die wij over u bewaren</li>
          <li><strong>Rectificatie</strong> — onjuiste gegevens in uw profiel corrigeren</li>
          <li><strong>Gegevenswissing ("recht op vergetelheid")</strong> — verwijdering van uw account en gegevens aanvragen</li>
          <li><strong>Beperking</strong> — ons vragen de verwerking van uw gegevens tijdelijk te staken</li>
          <li><strong>Overdraagbaarheid</strong> — uw gegevens ontvangen in een machineleesbaar formaat</li>
          <li><strong>Bezwaar</strong> — bezwaar maken tegen verwerking op basis van gerechtvaardigd belang</li>
          <li><strong>Toestemming intrekken</strong> — voor geolocatiegegevens, te allen tijde en zonder gevolgen</li>
        </ul>
        <p>Verzoek indienen: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Reactie binnen <strong>30 dagen</strong> (AVG Art. 12).</p>
        <p>Klacht indienen bij de <strong>Gegevensbeschermingsautoriteit (GBA)</strong>:<br />
          <a href={DPA_URL} target="_blank" rel="noopener noreferrer">{DPA_URL}</a> — contact@apd-gba.be — +32 2 274 48 00
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>RentIt gebruikt <strong>slechts één functionele cookie</strong>: een Supabase-authenticatiesessiecookie die nodig is om u ingelogd te houden. Deze cookie:</p>
        <ul style={listStyle}>
          <li>Volgt uw gedrag niet op andere websites</li>
          <li>Wordt niet gedeeld met derden voor advertentiedoeleinden</li>
          <li>Is geclassificeerd als "strikt noodzakelijk" onder de ePrivacy-richtlijn — er is geen toestemmingsbanner vereist</li>
        </ul>
        <p>Als wij in de toekomst analyse- of marketingcookies toevoegen, zullen wij dit beleid bijwerken en een toestemmingsmechanisme implementeren voordat wij dit doen.</p>
      </Section>

      <Section title="8. Gegevensbeveiliging">
        <p>Wij implementeren passende technische en organisatorische maatregelen, waaronder:</p>
        <ul style={listStyle}>
          <li>TLS-versleuteling voor alle gegevens in transit</li>
          <li>Row-Level Security (RLS) — elke gebruiker heeft alleen toegang tot zijn eigen gegevens</li>
          <li>Wij zien, vragen of bewaren geen enkel bank- of kaartgegeven — er verloopt geen betaling via het platform</li>
          <li>Toegang tot productiegegevens beperkt tot bevoegd personeel</li>
        </ul>
        <p>Bij een datalek dat uw rechten of vrijheden bedreigt, zullen wij de GBA binnen <strong>72 uur</strong> informeren en getroffen gebruikers zonder onnodige vertraging op de hoogte stellen (AVG Art. 33–34).</p>
      </Section>

      <Section title="9. Minderjarigen">
        <p>RentIt is niet bedoeld voor gebruikers jonger dan 18 jaar. Wij verzamelen niet bewust gegevens van minderjarigen. Als u denkt dat een minderjarige een account heeft aangemaakt, neem dan contact met ons op via <a href={`mailto:${EMAIL}`}>{EMAIL}</a> en wij zullen het account onmiddellijk verwijderen.</p>
      </Section>

      <Section title="10. Wijzigingen in dit beleid">
        <p>Wij kunnen dit Privacybeleid van tijd tot tijd bijwerken. Wij zullen u op de hoogte stellen van materiële wijzigingen via e-mail of een prominente mededeling op het platform, ten minste 30 dagen voordat de wijzigingen van kracht worden. De datum "Laatste update" bovenaan deze pagina geeft altijd de meest recente versie weer.</p>
      </Section>

      <Section title="11. Contact">
        <p><strong>{COMPANY}</strong><br />
          {ADDRESS}<br />
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
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