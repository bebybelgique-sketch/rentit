export const en = {
  // Navbar
  browse: 'Browse',
  listItem: '+ List a tool',
  myItems: 'My tools',
  myRentals: 'My rentals',
  profile: 'Profile',
  login: 'Log in',
  signup: 'Sign up',
  logout: 'Log out',

  // Home
  heroTitle: 'Your neighbor\'s tools,\nat your fingertips',
  heroSub: 'Rent professional tools from people nearby. Cheaper than buying, ready in minutes.',
  searchPlaceholder: 'Drill, pressure washer, sander…',
  maxPrice: 'Max €/day',
  nearby: 'Near me',
  noResults: 'No tools found',
  noResultsTitle: 'No tools found here yet',
  noResultsDesc: 'Be the first to list a tool in this area and help build the community.',
  earlyLister: 'Your listing goes live immediately, free of charge.',
  listFirstTool: 'List your first tool',
  expandSearch: 'Expand to 50 km',
  toolsAvailable: (n: number) => `${n} tool${n > 1 ? 's' : ''} available`,

  // Item detail
  contactViaBooking: 'Contact via the booking below',
  selectDates: 'Select dates',
  selectDatesHint: 'Choose start and end date',
  loginToBook: 'Log in to book',
  totalPrice: 'Total',
  deposit: 'Deposit (refundable)',
  perDay: '/day',
  phoneVerified: '✓ Phone verified',
  newOwner: '✦ New — first to rent!',
  shareWhatsApp: 'Share',
  ownerLabel: 'Owner',
  payment: 'Payment',
  bookingConfirmed: 'Booking confirmed! Redirecting…',

  // Categories
  categories: {
    power_tools: '⚡ Power tools',
    hand_tools: '🔧 Hand tools',
    garden: '🌿 Gardening',
    construction: '🏗️ Construction',
    cleaning: '🧹 Cleaning',
    measuring: '📐 Measuring & Detection',
  },

  categoryHints: {
    power_tools: 'Drills, saws, grinders, routers',
    hand_tools: 'Hammers, wrenches, pliers, clamps',
    garden: 'Mowers, hedge trimmers, blowers',
    construction: 'Scaffolding, mixers, compressors',
    cleaning: 'Pressure washers, floor scrubbers',
    measuring: 'Laser levels, detectors, testers',
  },

  categoryPrices: {
    power_tools: 'Drills €10–18 · Grinders €12–20 · Jigsaws €8–15',
    hand_tools: 'Hammer sets €5–10 · Wrench sets €6–12',
    garden: 'Mowers €20–35 · Brushcutters €15–25 · Pressure washers €25–40',
    construction: 'Scaffolding €30–60 · Mixers €25–45 · Compressors €20–35',
    cleaning: 'Floor scrubbers €25–40 · Steam cleaners €15–25',
    measuring: 'Laser levels €10–18 · Detectors €8–14',
  },

  conditions: {
    new: 'New',
    like_new: 'Like new',
    good: 'Good condition',
    fair: 'Fair',
  },

  status: {
    pending_approval: 'Awaiting approval',
    pending_payment: 'Awaiting payment',
    confirmed: 'Confirmed',
    active: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Declined',
    expired: 'Expired',
    payment_expired: 'Payment expired',
    disputed: 'Disputed',
  },

  // Auth — Register
  joinRentIt: 'Join RentIt',
  fullName: 'Full name',
  email: 'Email',
  passwordMin: 'Password (min. 8 characters)',
  createAccount: 'Create account',
  creatingAccount: 'Creating account…',
  alreadyAccount: 'Already have an account?',
  logInLink: 'Log in',
  invitedMsg: 'You\'ve been invited!',

  // Auth — Login
  loginTitle: 'Welcome back',
  password: 'Password',
  forgotPassword: 'Forgot password?',
  logIn: 'Log in',
  loggingIn: 'Logging in…',
  noAccount: 'No account yet?',
  signUpLink: 'Sign up',

  // List item
  newListing: 'New listing',
  listYourTool: 'List your tool',
  addPhotoFirst: 'Add a profile photo first',
  addPhotoDesc: 'Owners want to know who they\'re renting to. A photo builds trust.',
  addPhotoHint: 'Go to your profile to add a photo, then come back to list your tool.',
  addPhotoBtn: 'Go to profile',
  publishListing: 'Publish listing',
  publishing: 'Publishing…',
  yourListing: 'This is your listing',
  manageIt: 'manage it',
  forRentalShops: 'For rental shops →',

  shops: {
    eyebrow: 'For professionals',
    title: 'You rent out equipment? Your tools can live here too.',
    lede: "RentIt is a tool showcase in Walloon Brabant. A customer picks a tool and dates, you accept or decline, and you arrange the rest directly. Nothing more — and nothing else.",

    haveTitle: 'What you get today',
    have1: 'Your listings online immediately, at no cost.',
    have2: 'Customers pick their dates; dates already taken are no longer offered.',
    have3: 'Requests arrive in your dashboard; you accept or decline.',
    have4: 'Contact details are exchanged only once a booking is accepted.',

    notTitle: 'What RentIt does not do',
    notLede: 'Said upfront rather than after: these limits are part of the offer, not the small print.',
    not1: 'No money passes through RentIt. Settlement is in cash, between you and the customer.',
    not2: 'No insurance, no deposit held by the platform. RentIt is not a party to the contract.',
    not3: 'No commission today. If paid options ever arrive, they will be announced, not slipped in.',
    not4: 'No traffic promised. A listing is visible; it does not sell itself.',

    stateTitle: 'Where we actually stand',
    stateBody: 'The showcase is new and empty: the demo listings were removed, because an invented catalogue tells you nothing true. We are looking for the first rental businesses in Walloon Brabant. Being first means little competition and a listening ear — not a queue of customers.',

    ctaPrimary: 'Create an account',
    ctaSecondary: 'See the showcase',
  },
}
