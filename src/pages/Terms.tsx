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
// Сторона договора — физическое лицо, а не «RentIt». До 14.08 здесь
// стояли COMPANY = 'RentIt', ADDRESS = 'Belgium' и два ящика на
// rentit.be — домене, принадлежащем ПОСТОРОННЕМУ лицу: человек,
// оспаривающий блокировку или требующий удаления аккаунта, писал в
// пустоту. Два ящика при нуле пользователей сведены в один живой.
// Значения общие с письмами и политикой (src/domain/operator.ts).
const COMPANY = PLATFORM_NAME
const EMAIL = CONTACT_EMAIL
const SUPPORT_EMAIL = CONTACT_EMAIL
const ADDRESS = `${OPERATOR_NAME}, ${OPERATOR_ADDRESS}`
const GOVERNING_LAW = 'Belgian law'

export default function TermsOfService() {
  const lang = useDocumentLanguage()

  return (
    <div className="page">
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
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
        <p>The platform is operated by <strong>{OPERATOR_NAME}</strong>, a {OPERATOR_STATUS.en} established at {OPERATOR_ADDRESS}. These Terms constitute a legally binding agreement between you and {OPERATOR_NAME} under {GOVERNING_LAW}.</p>
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
          <li>If you return the item late, you owe the Owner the late fee shown on the listing for each additional day, or — if the Owner did not announce one — the daily rate. This is settled between you and the Owner in cash: RentIt does not calculate, charge or collect it.</li>
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
            <Tr data={['Late fee (if announced)', 'Owner, shown on the listing', 'Between the parties, at the return']} />
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
        <p>RentIt is an intermediary and is not a party to rental agreements between Owners and Renters. <strong>RentIt does not arbitrate disputes and cannot decide who owes what.</strong> We hold no deposit, so we can neither release nor withhold one.</p>
        <ul style={listStyle}>
          <li>Talk to the other party in the booking conversation. It is written down and both of you keep it.</li>
          <li>The handover and return photos are your evidence — take them.</li>
          <li>Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for platform matters: an account, a listing, conduct that breaches these Terms. We can act on those.</li>
          <li>For money owed between you, the ordinary route is Belgian law and, if needed, the courts named in section 14.</li>
        </ul>
      </Section>

      <Section title="10. Prohibited Conduct">
        <p>You may not:</p>
        <ul style={listStyle}>
          <li>Use RentIt for illegal purposes or to facilitate illegal activity</li>
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
        <p>The RentIt platform, its name, logo, and software are owned by {OPERATOR_NAME}, the operator of the platform, and protected by Belgian and EU intellectual property law. You may not copy, modify, or distribute any part of the platform without written permission.</p>
      </Section>

      <Section title="13. Termination">
        <p>You may delete your account at any time through your Profile settings or by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Active bookings must be completed or cancelled before deletion.</p>
        <p>RentIt may terminate or suspend your account if you violate these Terms, with or without notice depending on the severity of the violation.</p>
      </Section>

      <Section title="14. Governing Law and Disputes">
        <p>These Terms are governed by <strong>{GOVERNING_LAW}</strong>. Any dispute arising from these Terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts of <strong>Brussels, Belgium</strong>.</p>
        <p>Before initiating legal proceedings, you agree to attempt to resolve any dispute with us informally by contacting <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        <p>As a consumer in Belgium, you may also use the European Online Dispute Resolution platform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="15. Changes to These Terms">
        <p>We may update these Terms from time to time. We will notify you of material changes by email at least <strong>30 days</strong> before they take effect. Continued use of the platform after that date constitutes acceptance of the new Terms.</p>
      </Section>

      <Section title="16. Contact">
        <p>
          <strong>{COMPANY}</strong><br />
          {ADDRESS}<br />
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> — legal and support requests alike
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
        <p>La plateforme est exploitée par <strong>{OPERATOR_NAME}</strong>, {OPERATOR_STATUS.fr} établie à {OPERATOR_ADDRESS}. Les présentes Conditions constituent un accord juridiquement contraignant entre vous et {OPERATOR_NAME}, régi par le droit belge.</p>
      </Section>

      <Section title="2. Admissibilité">
        <ul style={listStyle}>
          <li>Vous devez avoir au moins <strong>18 ans</strong>.</li>
          <li>Vous devez fournir des informations d'inscription exactes et complètes.</li>
          <li>Vous devez avoir le droit de louer tout objet que vous publiez.</li>
          <li>Un compte par personne. La création de plusieurs comptes est interdite.</li>
        </ul>
      </Section>

      <Section title="3. Comptes utilisateurs">
        <p>Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte. Prévenez-nous immédiatement à <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> si vous soupçonnez un accès non autorisé.</p>
        <p>Nous pouvons suspendre ou supprimer un compte qui enfreint les présentes Conditions, sert à une fraude, ou fait l'objet de plaintes fondées et répétées.</p>
      </Section>

      <Section title="4. Publier une annonce (Propriétaires)">
        <ul style={listStyle}>
          <li>Vous devez posséder l'objet publié ou avoir le droit de le louer.</li>
          <li>L'annonce doit être exacte, complète et non trompeuse. Les photos doivent représenter l'objet réel.</li>
          <li>Vous fixez vous-même le prix par jour, les éventuels forfaits (3 jours, semaine), la caution et le montant de retard.</li>
          <li>Vous répondez de l'état annoncé : l'outil doit être propre, sûr et en état de marche au moment de la remise.</li>
          <li>Vous ne pouvez pas publier un objet illégal, dangereux sans certification, volé, ou grevé d'un droit empêchant la location.</li>
          <li>En publiant une annonce, vous accordez à RentIt une licence non exclusive et gratuite d'afficher vos photos d'annonce sur la plateforme.</li>
        </ul>
        <p><strong>Objets interdits, notamment :</strong> armes, explosifs, objets exigeant une licence professionnelle que vous ne détenez pas, matières dangereuses.</p>
      </Section>

      <Section title="5. Louer un outil (Locataires)">
        <ul style={listStyle}>
          <li>Réserver un objet crée un engagement entre vous et le Propriétaire.</li>
          <li>Vous n'utilisez l'outil que pour son usage prévu et conformément à la loi.</li>
          <li>Vous répondez des dommages, de la perte ou du vol de l'outil pendant la location.</li>
          <li>Vous rendez l'outil à la date convenue, dans l'état où vous l'avez reçu, usure normale exceptée.</li>
          <li>En cas de retard, vous devez au Propriétaire le montant de retard affiché sur l'annonce pour chaque jour supplémentaire ou, s'il n'en a pas annoncé, le tarif journalier. Ce montant se règle entre vous en espèces : RentIt ne le calcule pas, ne le facture pas et ne l'encaisse pas.</li>
        </ul>
      </Section>

      <Section title="6. Paiements entre utilisateurs">
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
            <Tr data={['Montant de retard (si annoncé)', "Le Propriétaire, affiché sur l'annonce", 'Entre les parties, à la restitution']} />
          </tbody>
        </table>

        <ul style={listStyle}>
          <li>Les montants affichés sur la plateforme sont <strong>indicatifs</strong> : ils reprennent ce que le Propriétaire a publié, et non une somme encaissée par RentIt.</li>
          <li>RentIt n'est pas un prestataire de services de paiement et n'intervient pas dans le règlement.</li>
          <li><strong>L'utilisation de la plateforme est actuellement gratuite.</strong> Cela peut évoluer : si des fonctionnalités payantes sont introduites, les utilisateurs en seront informés à l'avance et aucun montant ne sera jamais prélevé sans accord préalable.</li>
        </ul>
      </Section>

      <Section title="7. Annulations">
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

      <Section title="8. Responsabilité">
        <p><strong>RentIt ne fournit aucune assurance.</strong> Il n'existe ni couverture des dommages, ni fonds de garantie, ni indemnisation. L'outil est prêté entre particuliers, sous leur propre responsabilité.</p>
        <ul style={listStyle}>
          <li>Le Locataire répond envers le Propriétaire des dommages, de la perte ou du vol de l'outil.</li>
          <li>Le Propriétaire répond de la sécurité de l'outil et de son aptitude à l'usage annoncé.</li>
          <li>Il est vivement conseillé aux deux parties de <strong>photographier l'outil à la remise et au retour</strong> — la plateforme le permet pour chaque réservation, et les photos restent visibles des deux côtés.</li>
          <li>Vérifiez si votre assurance <em>responsabilité civile familiale</em> couvre ce type de prêt.</li>
        </ul>
        <p><strong>RentIt n'est pas partie au contrat de location.</strong> Son rôle se limite à mettre les personnes en relation et à héberger leurs échanges. RentIt n'est pas responsable de l'état ou de la qualité des outils, des pertes de revenus, des dommages indirects, ni des litiges entre utilisateurs.</p>
      </Section>

      <Section title="9. Litiges entre utilisateurs">
        <p>RentIt est un intermédiaire et n'est pas partie au contrat de location. <strong>RentIt n'arbitre pas les litiges et ne décide pas qui doit quoi à qui.</strong> Nous ne détenons aucune caution : nous ne pouvons donc ni la libérer ni la retenir.</p>
        <ul style={listStyle}>
          <li>Parlez-vous dans la conversation de réservation : elle est écrite et vous la conservez tous les deux.</li>
          <li>Les photos de remise et de retour sont vos preuves — prenez-les.</li>
          <li>Écrivez à <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> pour ce qui relève de la plateforme : un compte, une annonce, un comportement contraire aux présentes Conditions. Sur ces points-là, nous pouvons agir.</li>
          <li>Pour les sommes dues entre vous, la voie ordinaire est le droit belge et, si nécessaire, les tribunaux visés à l'article 14.</li>
        </ul>
      </Section>

      <Section title="10. Conduites interdites">
        <p>Il vous est interdit de :</p>
        <ul style={listStyle}>
          <li>utiliser RentIt à des fins illégales ou pour faciliter une activité illégale ;</li>
          <li>publier des annonces ou des avis faux, trompeurs ou frauduleux ;</li>
          <li>harceler, menacer ou discriminer d'autres utilisateurs ;</li>
          <li>tenter d'accéder aux comptes ou aux données d'autres utilisateurs ;</li>
          <li>extraire ou aspirer les données de la plateforme sans autorisation écrite ;</li>
          <li>utiliser la plateforme après en avoir été exclu.</li>
        </ul>
        <p>Une infraction peut entraîner la suspension immédiate du compte et des poursuites.</p>
      </Section>

      <Section title="11. Avis et contenus">
        <p>Les utilisateurs peuvent laisser un avis après une location terminée. L'avis doit être honnête, fondé sur une expérience directe, et non diffamatoire. RentIt peut retirer un avis qui enfreint ces règles. En publiant un contenu (avis, photos, descriptions), vous accordez à RentIt une licence non exclusive d'utilisation de ce contenu sur la plateforme.</p>
      </Section>

      <Section title="12. Propriété intellectuelle">
        <p>La plateforme {COMPANY}, son nom, son logo et son code sont la propriété de l'exploitant de la plateforme et protégés par le droit belge et européen de la propriété intellectuelle. Vous ne pouvez copier, modifier ni distribuer aucune partie de la plateforme sans autorisation écrite.</p>
      </Section>

      <Section title="13. Résiliation">
        <p>Vous pouvez supprimer votre compte à tout moment depuis votre profil ou en écrivant à <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Les réservations en cours doivent être terminées ou annulées avant la suppression.</p>
        <p>RentIt peut suspendre ou supprimer votre compte en cas de manquement aux présentes Conditions, avec ou sans préavis selon la gravité.</p>
      </Section>

      <Section title="14. Droit applicable">
        <p>Les présentes CGU sont régies par le <strong>droit belge</strong>. Tout litige relève de la compétence exclusive des tribunaux de <strong>Bruxelles, Belgique</strong>.</p>
        <p>Avant toute procédure, vous acceptez de tenter un règlement amiable en écrivant à <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        <p>En tant que consommateur en Belgique, vous pouvez aussi recourir à la plateforme européenne de résolution en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="15. Modification des présentes Conditions">
        <p>Nous pouvons mettre à jour ces Conditions. En cas de modification substantielle, nous vous en informerons par e-mail au moins <strong>30 jours</strong> avant son entrée en vigueur. L'usage de la plateforme après cette date vaut acceptation des nouvelles Conditions.</p>
      </Section>

      <Section title="16. Contact">
        <p><strong>{COMPANY}</strong> — {ADDRESS}<br />
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> — questions juridiques comme demandes de support
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
        <p>Het platform wordt uitgebaat door <strong>{OPERATOR_NAME}</strong>, {OPERATOR_STATUS.nl} gevestigd te {OPERATOR_ADDRESS}. Deze Voorwaarden vormen een juridisch bindende overeenkomst tussen u en {OPERATOR_NAME}, beheerst door het Belgisch recht.</p>
      </Section>

      <Section title="2. Toelating">
        <ul style={listStyle}>
          <li>U moet minimaal <strong>18 jaar</strong> oud zijn.</li>
          <li>U moet nauwkeurige registratiegegevens verstrekken.</li>
          <li>U moet het recht hebben om elk voorwerp dat u plaatst te verhuren.</li>
          <li>Één account per persoon. Meerdere accounts aanmaken is verboden.</li>
        </ul>
      </Section>

      <Section title="3. Gebruikersaccounts">
        <p>U bent verantwoordelijk voor de vertrouwelijkheid van uw inloggegevens en voor alles wat vanaf uw account gebeurt. Waarschuw ons onmiddellijk via <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> als u ongeoorloofde toegang vermoedt.</p>
        <p>Wij kunnen een account opschorten of verwijderen dat deze Voorwaarden schendt, voor fraude wordt gebruikt, of herhaaldelijk gegronde klachten oplevert.</p>
      </Section>

      <Section title="4. Een advertentie plaatsen (Verhuurders)">
        <ul style={listStyle}>
          <li>U moet het geplaatste voorwerp bezitten of het recht hebben het te verhuren.</li>
          <li>De advertentie moet juist, volledig en niet misleidend zijn. Foto's moeten het echte voorwerp tonen.</li>
          <li>U bepaalt zelf de dagprijs, eventuele forfaits (3 dagen, week), de borg en het bedrag bij te late teruggave.</li>
          <li>U staat in voor de aangekondigde staat: het gereedschap is schoon, veilig en werkend bij de overhandiging.</li>
          <li>U mag geen voorwerp plaatsen dat illegaal is, gevaarlijk zonder certificering, gestolen, of bezwaard met een recht dat verhuur belet.</li>
          <li>Door een advertentie te plaatsen verleent u RentIt een niet-exclusieve, kosteloze licentie om uw advertentiefoto's op het platform te tonen.</li>
        </ul>
        <p><strong>Verboden voorwerpen, onder meer:</strong> wapens, explosieven, voorwerpen waarvoor een beroepsvergunning nodig is die u niet heeft, gevaarlijke stoffen.</p>
      </Section>

      <Section title="5. Gereedschap huren (Huurders)">
        <ul style={listStyle}>
          <li>Een reservering schept een verbintenis tussen u en de Verhuurder.</li>
          <li>U gebruikt het gereedschap alleen waarvoor het bedoeld is en volgens de wet.</li>
          <li>U bent aansprakelijk voor schade, verlies of diefstal tijdens de huurperiode.</li>
          <li>U geeft het gereedschap terug op de afgesproken datum, in de staat waarin u het ontving, normale slijtage uitgezonderd.</li>
          <li>Bij te late teruggave bent u de Verhuurder het in de advertentie vermelde bedrag per extra dag verschuldigd, of — als hij er geen aankondigde — de dagprijs. Dit wordt onderling contant geregeld: RentIt berekent, factureert en int dit niet.</li>
        </ul>
      </Section>

      <Section title="6. Betalingen tussen gebruikers">
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
            <Tr data={['Bedrag bij te late teruggave (indien aangekondigd)', 'Verhuurder, vermeld in de advertentie', 'Tussen partijen, bij de teruggave']} />
          </tbody>
        </table>

        <ul style={listStyle}>
          <li>De op het platform getoonde bedragen zijn <strong>indicatief</strong>: ze geven weer wat de Verhuurder heeft gepubliceerd, niet een som die RentIt int.</li>
          <li>RentIt is geen betaaldienstverlener en komt niet tussen bij de afrekening.</li>
          <li><strong>Het gebruik van het platform is momenteel gratis.</strong> Dit kan veranderen: als betalende functies worden ingevoerd, worden gebruikers vooraf geïnformeerd en wordt nooit een bedrag aangerekend zonder voorafgaande toestemming.</li>
        </ul>
      </Section>

      <Section title="7. Annuleringen">
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

      <Section title="8. Aansprakelijkheid">
        <p><strong>RentIt biedt geen verzekering.</strong> Er is geen schadedekking, geen waarborgfonds en geen vergoedingsregeling. Het gereedschap wordt tussen particulieren uitgeleend, onder hun eigen verantwoordelijkheid.</p>
        <ul style={listStyle}>
          <li>De Huurder is tegenover de Verhuurder aansprakelijk voor schade, verlies of diefstal van het gereedschap.</li>
          <li>De Verhuurder staat in voor de veiligheid van het gereedschap en de geschiktheid voor het aangekondigde gebruik.</li>
          <li>Beide partijen wordt sterk aangeraden het gereedschap <strong>te fotograferen bij de overhandiging en bij de teruggave</strong> — het platform voorziet dit per reservering, en de foto's blijven voor beide zichtbaar.</li>
          <li>Ga na of uw <em>familiale burgerlijke aansprakelijkheidsverzekering</em> dit soort uitlening dekt.</li>
        </ul>
        <p><strong>RentIt is geen partij bij de huurovereenkomst.</strong> De rol beperkt zich tot het in contact brengen van mensen en het hosten van hun uitwisselingen. RentIt is niet aansprakelijk voor de staat of kwaliteit van het gereedschap, gederfde inkomsten, indirecte schade of geschillen tussen gebruikers.</p>
      </Section>

      <Section title="9. Geschillen tussen gebruikers">
        <p>RentIt is een tussenpersoon en geen partij bij de huurovereenkomst. <strong>RentIt beslecht geen geschillen en bepaalt niet wie wat verschuldigd is.</strong> Wij houden geen borg aan: wij kunnen die dus niet vrijgeven en niet inhouden.</p>
        <ul style={listStyle}>
          <li>Praat met elkaar in het reserveringsgesprek: het staat op schrift en u bewaart het allebei.</li>
          <li>De foto's bij overhandiging en teruggave zijn uw bewijs — maak ze.</li>
          <li>Schrijf naar <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> voor wat het platform betreft: een account, een advertentie, gedrag in strijd met deze Voorwaarden. Daarop kunnen wij handelen.</li>
          <li>Voor bedragen die u elkaar verschuldigd bent geldt de gewone weg: het Belgisch recht en, indien nodig, de rechtbanken uit artikel 14.</li>
        </ul>
      </Section>

      <Section title="10. Verboden gedrag">
        <p>Het is u verboden:</p>
        <ul style={listStyle}>
          <li>RentIt te gebruiken voor illegale doeleinden of om illegale activiteit te vergemakkelijken;</li>
          <li>valse, misleidende of frauduleuze advertenties of beoordelingen te plaatsen;</li>
          <li>andere gebruikers te intimideren, te bedreigen of te discrimineren;</li>
          <li>te proberen toegang te krijgen tot accounts of gegevens van anderen;</li>
          <li>gegevens van het platform te schrapen of te extraheren zonder schriftelijke toestemming;</li>
          <li>het platform te gebruiken nadat u bent uitgesloten.</li>
        </ul>
        <p>Een inbreuk kan leiden tot onmiddellijke opschorting van het account en tot gerechtelijke stappen.</p>
      </Section>

      <Section title="11. Beoordelingen en inhoud">
        <p>Gebruikers kunnen een beoordeling achterlaten na een afgeronde verhuur. Een beoordeling moet eerlijk zijn, gebaseerd op eigen ervaring, en niet lasterlijk. RentIt kan een beoordeling verwijderen die deze regels schendt. Door inhoud te plaatsen (beoordelingen, foto's, beschrijvingen) verleent u RentIt een niet-exclusieve licentie om die inhoud op het platform te gebruiken.</p>
      </Section>

      <Section title="12. Intellectuele eigendom">
        <p>Het platform {COMPANY}, de naam, het logo en de software zijn eigendom van de uitbater van het platform en beschermd door Belgisch en Europees recht inzake intellectuele eigendom. U mag geen enkel deel van het platform kopiëren, wijzigen of verspreiden zonder schriftelijke toestemming.</p>
      </Section>

      <Section title="13. Beëindiging">
        <p>U kunt uw account op elk moment verwijderen via uw profiel of door te schrijven naar <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Lopende reserveringen moeten eerst afgerond of geannuleerd zijn.</p>
        <p>RentIt kan uw account opschorten of verwijderen bij schending van deze Voorwaarden, met of zonder voorafgaande kennisgeving naargelang de ernst.</p>
      </Section>

      <Section title="14. Toepasselijk recht">
        <p>Deze Voorwaarden zijn onderworpen aan het <strong>Belgisch recht</strong>. Geschillen vallen onder de exclusieve bevoegdheid van de rechtbanken van <strong>Brussel, België</strong>.</p>
        <p>Vóór elke procedure aanvaardt u een minnelijke regeling te proberen via <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        <p>Als consument in België kunt u ook terecht bij het Europese platform voor onlinegeschillenbeslechting: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p>
      </Section>

      <Section title="15. Wijziging van deze Voorwaarden">
        <p>Wij kunnen deze Voorwaarden bijwerken. Bij een wezenlijke wijziging informeren wij u per e-mail ten minste <strong>30 dagen</strong> vóór de inwerkingtreding. Gebruik van het platform na die datum geldt als aanvaarding van de nieuwe Voorwaarden.</p>
      </Section>

      <Section title="16. Contact">
        <p><strong>{COMPANY}</strong> — {ADDRESS}<br />
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> — zowel juridische vragen als support
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