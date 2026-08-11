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
  bookAndPay: (price: string) => `Book and pay ${price}`,
  loginToBook: 'Log in to book & pay',
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
}
