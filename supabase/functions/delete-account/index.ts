// Deletes the calling user's own auth account (and, via ON DELETE CASCADE on
// trees.owner_id / profiles.id, all the data they own). Uses the service role,
// which is only available inside the Edge Function — never shipped to the client.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
	if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

	const authHeader = req.headers.get('Authorization') ?? '';
	const url = Deno.env.get('SUPABASE_URL')!;
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

	// Identify the caller from their JWT.
	const userClient = createClient(url, anonKey, {
		global: { headers: { Authorization: authHeader } }
	});
	const {
		data: { user }
	} = await userClient.auth.getUser();
	if (!user) return new Response('Unauthorized', { status: 401 });

	// Delete them with the admin (service-role) client.
	const admin = createClient(url, serviceKey);
	const { error } = await admin.auth.admin.deleteUser(user.id);
	if (error) return new Response(error.message, { status: 400 });

	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'content-type': 'application/json' }
	});
});
