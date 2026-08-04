// Delete the calling user's auth identity.
//
// Deploy:  supabase functions deploy delete-account
//
// The client (deleteAccountRemote in src/utils/sync.ts) removes the user's
// data rows first — it already has the right to, since every table's RLS is
// `ALL USING (user_id = auth.uid())`. What it cannot do is remove the
// auth.users row: that needs the service_role key, which must never ship in a
// client bundle. Hence this function.
//
// SECURITY: the user id comes from the caller's JWT, never from the request
// body. A body-supplied id would let any authenticated user delete any other
// account by guessing a uuid.
//
// Required App Store Review Guideline 5.1.1(v): account creation obliges
// in-app account deletion.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Function is misconfigured' }, 500);

  // Resolve the caller from their own token. This is the whole security model
  // of the function — do not accept an id from anywhere else.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Invalid or expired token' }, 401);

  const userId = userData.user.id;

  const admin = createClient(url, serviceKey);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('[delete-account] deleteUser failed', { userId, message: deleteError.message });
    return json({ error: 'Could not delete account' }, 500);
  }

  console.log('[delete-account] deleted', { userId });
  return json({ deleted: true }, 200);
});
