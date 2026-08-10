import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const userId = user.id

  // Block deletion if user has active or confirmed bookings (as renter or owner)
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('id, items(owner_id)')
    .or(`renter_id.eq.${userId}`)
    .in('status', ['pending_approval', 'pending_payment', 'confirmed', 'active'])
    .limit(1)

  if (activeBookings && activeBookings.length > 0) {
    return json({ error: 'Vous avez des réservations actives. Veuillez les terminer ou les annuler avant de supprimer votre compte.' }, 409)
  }

  // Also check bookings where user is owner
  const { data: ownerBookings } = await supabase
    .from('bookings')
    .select('id, item_id, items!inner(owner_id)')
    .eq('items.owner_id', userId)
    .in('status', ['pending_approval', 'pending_payment', 'confirmed', 'active'])
    .limit(1)

  if (ownerBookings && ownerBookings.length > 0) {
    return json({ error: 'Vous avez des réservations actives en tant que propriétaire. Veuillez les terminer avant de supprimer votre compte.' }, 409)
  }

  // Anonymise bookings (keep financial records for 7 years per Belgian law)
  await supabase
    .from('bookings')
    .update({ renter_id: null })
    .eq('renter_id', userId)

  // Delete user's items (and their photos are orphaned — acceptable)
  await supabase.from('items').delete().eq('owner_id', userId)

  // Delete avatar from storage
  const ext = ['jpg', 'jpeg', 'png', 'webp']
  for (const e of ext) {
    await supabase.storage.from('avatars').remove([`${userId}.${e}`])
  }

  // Delete the auth user (cascades to public.users via FK or trigger)
  const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId)
  if (deleteErr) return json({ error: deleteErr.message }, 500)

  return json({ success: true })
})
