export const fr = {
  // Navbar
  browse: 'Parcourir',
  listItem: '+ Déposer une annonce',
  myItems: 'Mes outils',
  myRentals: 'Mes locations',
  profile: 'Profil',
  login: 'Se connecter',
  signup: "S'inscrire",
  logout: 'Déconnexion',

  // Home
  heroTitle: 'Les outils de votre voisin,\nà portée de main',
  heroSub: "Louez des outils professionnels près de chez vous — moins cher qu'acheter, disponible en minutes",
  searchPlaceholder: 'Rechercher des outils...',
  maxPrice: 'Max €/jour',
  nearby: '📍 À proximité',
  noResults: 'Aucun outil trouvé',
  noResultsTitle: 'Aucun outil dans cette zone',
  noResultsDesc: 'Soyez le premier à déposer une annonce ici.',
  earlyLister: 'Votre annonce est visible immédiatement, gratuitement.',
  listFirstTool: 'Déposer votre premier outil →',
  expandSearch: 'Élargir à 50 km',
  toolsAvailable: (n: number) => `${n} outil${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''}`,

  // Item detail
  contactViaBooking: 'Contacter via la réservation ci-dessous',
  selectDates: 'Choisir les dates',
  selectDatesHint: 'Cliquez sur une date de début, puis une date de fin',
  loginToBook: 'Se connecter pour réserver',
  totalPrice: 'Total',
  deposit: 'Caution (remboursable)',
  perDay: '/jour',
  phoneVerified: '✓ Téléphone vérifié',
  newOwner: '✦ Nouveau — soyez le premier !',
  shareWhatsApp: 'Partager',
  ownerLabel: 'Propriétaire',
  payment: 'Paiement',
  bookingConfirmed: 'Réservation confirmée ! Redirection...',

  // Categories
  categories: {
    power_tools: '⚡ Électroportatif',
    hand_tools: '🔧 Outillage manuel',
    garden: '🌿 Jardinage',
    construction: '🏗️ Construction',
    cleaning: '🧹 Nettoyage',
    measuring: '📐 Mesure & Détection',
  },

  // Auth — Register
  joinRentIt: 'Rejoindre RentIt',
  fullName: 'Nom complet',
  email: 'Email',
  passwordMin: 'Mot de passe (min. 8 caractères)',
  createAccount: 'Créer un compte',
  creatingAccount: 'Création du compte...',
  alreadyAccount: 'Déjà un compte ?',
  logInLink: 'Se connecter',
  invitedMsg: '🎉 Vous avez été invité(e) ! Inscrivez-vous pour commencer.',

  // Auth — Login
  loginTitle: 'Se connecter à RentIt',
  password: 'Mot de passe',
  forgotPassword: 'Mot de passe oublié ?',
  logIn: 'Se connecter',
  loggingIn: 'Connexion...',
  noAccount: 'Pas encore de compte ?',
  signUpLink: "S'inscrire",

  // List item
  newListing: 'Nouvelle annonce',
  listYourTool: 'Déposer votre outil',
  addPhotoFirst: 'Ajoutez une photo de profil',
  addPhotoDesc: 'Les locataires réservent 3× plus souvent auprès de propriétaires avec une vraie photo.',
  addPhotoHint: 'Ça prend 10 secondes et renforce la confiance immédiatement.',
  addPhotoBtn: 'Ajouter ma photo →',
  publishListing: 'Publier l\'annonce',
  publishing: 'Publication...',
  yourListing: 'C\'est votre annonce',
  manageIt: 'la gérer',
  forRentalShops: 'Pour les loueurs professionnels →',

  // Страница для прокатных контор. Тарифов здесь нет, потому что их нет в
  // продукте; чисел вроде «нас уже выбрали N контор» нет, потому что контор
  // ноль, и выдуманное число ради веса — приём, после которого не верят
  // ничему остальному.
  shops: {
    eyebrow: 'Pour les professionnels',
    title: 'Vous louez du matériel ? Vos outils peuvent aussi vivre ici.',
    lede: "RentIt est une vitrine d'outils en Brabant wallon. Le client choisit un outil et des dates, vous acceptez ou refusez, et vous vous arrangez directement. Rien de plus, et surtout rien d'autre.",

    haveTitle: "Ce que vous avez aujourd'hui",
    have1: 'Vos annonces en ligne immédiatement, sans frais.',
    have2: 'Le client choisit ses dates ; celles déjà prises ne lui sont plus proposées.',
    have3: 'Les demandes arrivent dans votre espace ; vous acceptez ou refusez.',
    have4: "Les coordonnées ne sont échangées qu'une fois la réservation acceptée.",

    notTitle: 'Ce que RentIt ne fait pas',
    notLede: "Dit avant plutôt qu'après : ces limites font partie de l'offre, pas des petits caractères.",
    not1: "Aucun paiement ne transite par RentIt. Le règlement se fait en espèces, entre vous et le client.",
    not2: "Aucune assurance, aucune caution retenue par la plateforme. RentIt n'est pas partie au contrat.",
    not3: "Aucune commission aujourd'hui. Si des options payantes arrivent un jour, elles seront annoncées, pas glissées.",
    not4: 'Aucun trafic promis. Une annonce est visible, elle ne se vend pas toute seule.',

    stateTitle: 'Où nous en sommes, sans arrondi',
    stateBody: "La vitrine est neuve et vide : les annonces de démonstration ont été retirées, parce qu'un catalogue inventé ne dit rien de vrai. Nous cherchons les premiers loueurs du Brabant wallon. Être le premier, c'est peu de concurrence et une oreille attentive — pas une file d'attente de clients.",

    ctaPrimary: 'Créer un compte',
    ctaSecondary: 'Voir la vitrine',
  },
}
