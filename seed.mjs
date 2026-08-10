/**
 * RentIt — Seed script
 * Usage: SUPABASE_ANON_KEY=xxx SEED_EMAIL=you@example.com node seed.mjs
 * Logs in as SEED_EMAIL, inserts 20 realistic Brussels tool listings.
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://zzvwangbomqczyiitigg.supabase.co'
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || ''
const EMAIL         = process.env.SEED_EMAIL || ''

// ── Brabant Wallon locations (toutes communes) ────────────────────────────────
const LOCATIONS = [
  { lat: 50.7176, lng: 4.6096, address: 'Rue de Namur 12, Wavre' },
  { lat: 50.7210, lng: 4.6050, address: 'Chaussée de Bruxelles 45, Wavre' },
  { lat: 50.6686, lng: 4.6151, address: 'Place de l\'Université 3, Louvain-la-Neuve' },
  { lat: 50.6667, lng: 4.5700, address: 'Rue des Bruyères 8, Ottignies' },
  { lat: 50.6333, lng: 4.5667, address: 'Rue Emile Vandervelde 22, Court-Saint-Etienne' },
  { lat: 50.7167, lng: 4.5167, address: 'Avenue de Merode 15, Rixensart' },
  { lat: 50.7200, lng: 4.3980, address: 'Chaussée de Bruxelles 88, Waterloo' },
  { lat: 50.6833, lng: 4.3700, address: 'Rue du Culot 5, Braine-l\'Alleud' },
  { lat: 50.6500, lng: 4.4667, address: 'Rue de la Station 30, Lasne' },
  { lat: 50.5979, lng: 4.3322, address: 'Rue de Mons 14, Nivelles' },
  { lat: 50.6167, lng: 4.8167, address: 'Rue de Gembloux 7, Perwez' },
  { lat: 50.7167, lng: 4.8667, address: 'Grand-Place 2, Jodoigne' },
  { lat: 50.6667, lng: 4.7167, address: 'Rue de Wavre 18, Chaumont-Gistoux' },
  { lat: 50.6833, lng: 4.2000, address: 'Rue de la Déportation 40, Tubize' },
  { lat: 50.7333, lng: 4.4833, address: 'Drève de la Ramée 6, La Hulpe' },
  { lat: 50.6167, lng: 4.6167, address: 'Rue du Try-au-Chêne 3, Mont-Saint-Guibert' },
  { lat: 50.6000, lng: 4.6833, address: 'Place Communale 1, Walhain' },
  { lat: 50.5833, lng: 4.4500, address: 'Rue de Bruxelles 55, Genappe' },
  { lat: 50.6667, lng: 4.7667, address: 'Rue du Centre 11, Incourt' },
  { lat: 50.6500, lng: 4.5800, address: 'Rue Fond des Sarts 4, Chastre' },
]

// ── 20 tool listings (Bosch, DeWalt, Kärcher, Milwaukee, Hilti) ───────────────
const ITEMS = [
  {
    title: 'Bosch Professional GSB 18V-55 Drill',
    description: 'Perceuse visseuse sans fil, 2× 2.0Ah batteries incluses. Idéale pour murs, bois, métal. Révisée récemment.',
    category: 'power_tools',
    condition: 'like_new',
    price_per_day: 14.00,
    deposit: 40.00,
    photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
    ...LOCATIONS[0],
  },
  {
    title: 'Kärcher K5 Premium Pressure Washer',
    description: '145 bar, 500 l/h. Idéal pour terrasses, voitures, mobilier de jardin. Tous tuyaux et buses inclus.',
    category: 'cleaning',
    condition: 'good',
    price_per_day: 28.00,
    deposit: 60.00,
    photos: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'],
    ...LOCATIONS[1],
  },
  {
    title: 'DeWalt DWE6423 Random Orbit Sander',
    description: 'Ponceuse orbitale 125mm, vitesse variable. Sac à poussière inclus. Parfait pour le ponçage de meubles.',
    category: 'power_tools',
    condition: 'good',
    price_per_day: 12.00,
    deposit: 30.00,
    photos: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80'],
    ...LOCATIONS[2],
  },
  {
    title: 'Bosch Rotak 43 Li Cordless Lawn Mower',
    description: 'Tondeuse sans fil, largeur de coupe 43cm. Batterie incluse. Silencieuse — pas d\'essence.',
    category: 'garden',
    condition: 'good',
    price_per_day: 25.00,
    deposit: 50.00,
    photos: ['https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=800&q=80'],
    ...LOCATIONS[3],
  },
  {
    title: 'Hilti TE 30 Rotary Hammer',
    description: 'Perforateur SDS-Plus 800W, 3 modes. Idéal pour béton et maçonnerie. 5 forets SDS inclus.',
    category: 'power_tools',
    condition: 'good',
    price_per_day: 22.00,
    deposit: 80.00,
    photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
    ...LOCATIONS[4],
  },
  {
    title: 'Milwaukee M18 Fuel Circular Saw',
    description: 'Scie circulaire sans fil 184mm. Batterie 5Ah et chargeur rapide inclus. Coupe nette du bois et OSB.',
    category: 'power_tools',
    condition: 'like_new',
    price_per_day: 20.00,
    deposit: 70.00,
    photos: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80'],
    ...LOCATIONS[5],
  },
  {
    title: 'Husqvarna 135 Chainsaw 35cm',
    description: 'Tronçonneuse thermique 38cc, guide-chaîne 35cm. Gants de sécurité fournis. Parfaite pour abattage et élagage.',
    category: 'garden',
    condition: 'good',
    price_per_day: 30.00,
    deposit: 80.00,
    photos: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80'],
    ...LOCATIONS[6],
  },
  {
    title: 'Kärcher SE 4002 Carpet & Floor Washer',
    description: 'Aspirateur laveur pour sols durs et moquettes. Réservoir 4L. Nettoyage en profondeur garanti.',
    category: 'cleaning',
    condition: 'good',
    price_per_day: 22.00,
    deposit: 45.00,
    photos: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'],
    ...LOCATIONS[7],
  },
  {
    title: 'Festool TS 55 Track Saw + 1.4m Rail',
    description: 'Scie plongeante professionnelle avec rail de guidage 1.4m. Port aspiration. Pour coupes nettes de panneaux.',
    category: 'power_tools',
    condition: 'like_new',
    price_per_day: 35.00,
    deposit: 100.00,
    photos: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80'],
    ...LOCATIONS[8],
  },
  {
    title: 'Clarke 100L Cement Mixer',
    description: 'Bétonnière 100 litres, moteur 550W. Parfaite pour murs de jardin, allées, petites dalles.',
    category: 'construction',
    condition: 'good',
    price_per_day: 35.00,
    deposit: 70.00,
    photos: ['https://images.unsplash.com/photo-1581579186913-45ac3e6efe93?w=800&q=80'],
    ...LOCATIONS[9],
  },
  {
    title: 'Leica Disto E7500i Laser Distance Meter',
    description: 'Portée 200m, précision ±1mm. Bluetooth. Idéal pour mesures avant rénovation.',
    category: 'measuring',
    condition: 'like_new',
    price_per_day: 15.00,
    deposit: 40.00,
    photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
    ...LOCATIONS[10],
  },
  {
    title: 'Bosch GCO 14-24 J Chop Saw',
    description: 'Scie à onglets 1800W, coupe 300mm. Idéale pour coupes angulaires précises bois et métal.',
    category: 'power_tools',
    condition: 'good',
    price_per_day: 25.00,
    deposit: 60.00,
    photos: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80'],
    ...LOCATIONS[11],
  },
  {
    title: 'Stanley FatMax 7-Piece Chisel Set',
    description: 'Acier chrome-allié. Tailles 6–38mm. Rouleau en cuir inclus. Parfait pour menuiserie et sculpture.',
    category: 'hand_tools',
    condition: 'new',
    price_per_day: 8.00,
    deposit: 20.00,
    photos: ['https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80'],
    ...LOCATIONS[12],
  },
  {
    title: 'DeWalt Air Compressor D55168',
    description: 'Compresseur 15L, 1.5HP, 8 bar. Kit 5 accessoires inclus. Pour cloueurs et pistolets de peinture.',
    category: 'construction',
    condition: 'good',
    price_per_day: 20.00,
    deposit: 50.00,
    photos: ['https://images.unsplash.com/photo-1581579186913-45ac3e6efe93?w=800&q=80'],
    ...LOCATIONS[13],
  },
  {
    title: 'Bosch UniversalHeat 600 Heat Gun',
    description: 'Pistolet thermique 600W, 2 températures (300°C / 500°C). Décapage peinture, désolidarisation.',
    category: 'power_tools',
    condition: 'like_new',
    price_per_day: 10.00,
    deposit: 25.00,
    photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
    ...LOCATIONS[14],
  },
  {
    title: 'Makita DGA452Z Angle Grinder 115mm',
    description: 'Meuleuse d\'angle 18V sans fil. 8500 tr/min. Parfaite pour couper et meuler métal et pierre.',
    category: 'power_tools',
    condition: 'good',
    price_per_day: 16.00,
    deposit: 45.00,
    photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
    ...LOCATIONS[15],
  },
  {
    title: 'Bosch Rotak 650 Electric Lawn Mower 48cm',
    description: 'Tondeuse filaire 2300W, largeur 48cm. Sac 70L. Pour grandes surfaces de gazon.',
    category: 'garden',
    condition: 'good',
    price_per_day: 18.00,
    deposit: 40.00,
    photos: ['https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=800&q=80'],
    ...LOCATIONS[16],
  },
  {
    title: 'Stanley Professional Tile Cutter 600mm',
    description: 'Coupe-carreaux manuel à rail pour sols et murs jusqu\'à 600mm. Coupes nettes, sans poussière.',
    category: 'construction',
    condition: 'like_new',
    price_per_day: 15.00,
    deposit: 35.00,
    photos: ['https://images.unsplash.com/photo-1581579186913-45ac3e6efe93?w=800&q=80'],
    ...LOCATIONS[17],
  },
  {
    title: 'Milwaukee M18 Fuel Impact Driver',
    description: 'Visseuse à choc 18V, couple 305 Nm. Batterie 5Ah et chargeur inclus. Vissage ultra-rapide.',
    category: 'power_tools',
    condition: 'like_new',
    price_per_day: 15.00,
    deposit: 50.00,
    photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
    ...LOCATIONS[18],
  },
  {
    title: 'Bosch UniversalGardenTidy Blower Vac',
    description: '3-en-1 : souffleur / aspirateur / broyeur. Sac 45L. Léger à 3.5kg. Sans fil.',
    category: 'garden',
    condition: 'good',
    price_per_day: 14.00,
    deposit: 25.00,
    photos: ['https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=800&q=80'],
    ...LOCATIONS[19],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱  RentIt Seed Script — Brussels only\n')

  if (!SUPABASE_ANON) {
    console.error('❌  Set SUPABASE_ANON_KEY env var first:')
    console.error('    SUPABASE_ANON_KEY=your_anon_key node seed.mjs\n')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

  // Auth
  const password = process.env.SUPABASE_PASSWORD || await ask(`🔑  Password for ${EMAIL}: `)
  process.stdout.write('   Signing in... ')

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: password.trim(),
  })

  if (authErr || !authData.user) {
    console.log('❌')
    console.error(`\n   Auth error: ${authErr?.message || 'unknown'}\n`)
    process.exit(1)
  }

  console.log(`✅  Signed in as ${authData.user.email}`)
  const userId = authData.user.id
  console.log(`   User ID: ${userId}\n`)

  // Mark seed owner as phone_verified + add avatar
  process.stdout.write('   Updating owner profile (phone_verified + avatar)... ')
  const { error: profileErr } = await supabase
    .from('users')
    .update({
      phone_verified: true,
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    })
    .eq('id', userId)
  console.log(profileErr ? `❌  ${profileErr.message}` : '✅')

  // Check existing items
  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)

  if (count && count > 0) {
    const overwrite = await ask(`\n⚠️   You already have ${count} listings. Add more anyway? (y/n): `)
    if (overwrite.trim().toLowerCase() !== 'y') {
      console.log('\n   Aborted.\n')
      process.exit(0)
    }
  }

  // Insert items
  console.log(`\n📦  Inserting ${ITEMS.length} Brussels tool listings...\n`)
  let success = 0
  let failed = 0

  for (const item of ITEMS) {
    process.stdout.write(`   • ${item.title.slice(0, 45).padEnd(45)} `)
    const { error } = await supabase.from('items').insert({
      owner_id: userId,
      available: true,
      ...item,
    })
    if (error) {
      console.log(`❌  ${error.message}`)
      failed++
    } else {
      console.log('✅')
      success++
    }
  }

  console.log(`\n✨  Done — ${success} inserted, ${failed} failed.`)
  console.log(`🔗  View: https://rentit-staging.vercel.app/browse\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
