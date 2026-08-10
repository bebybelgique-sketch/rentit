/**
 * RentIt — Run SQL migration via Supabase Management API
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node migrate.mjs
 */

const SUPABASE_URL = 'https://zzvwangbomqczyiitigg.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const PROJECT_REF  = 'zzvwangbomqczyiitigg'

if (!SERVICE_KEY) {
  console.error('❌  Set SUPABASE_SERVICE_ROLE_KEY env var first')
  console.error('    Find it in: Supabase Dashboard → Project Settings → API → service_role secret')
  process.exit(1)
}

const SQL = `
CREATE TABLE IF NOT EXISTS public.events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,
  item_id    uuid REFERENCES public.items(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  meta       jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Anyone can insert events'
  ) THEN
    CREATE POLICY "Anyone can insert events" ON public.events FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Only admins read events'
  ) THEN
    CREATE POLICY "Only admins read events" ON public.events FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;
`

async function run() {
  console.log('\n🚀  Running events table migration...\n')

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  })

  // Try Management API if REST doesn't work
  if (!res.ok) {
    console.log('   Trying Management API...')
    const res2 = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: SQL }),
    })

    if (!res2.ok) {
      const err = await res2.text()
      console.error(`❌  Migration failed: ${err}`)
      console.error('\n💡  Alternative: paste the SQL manually in Supabase Dashboard → SQL Editor:')
      console.error('    https://supabase.com/dashboard/project/zzvwangbomqczyiitigg/sql/new\n')
      process.exit(1)
    }

    console.log('✅  Migration applied via Management API!')
    return
  }

  console.log('✅  events table created with RLS policies!')
}

run().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
