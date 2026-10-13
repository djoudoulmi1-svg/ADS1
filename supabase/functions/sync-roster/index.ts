const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const sheetUrl = Deno.env.get("SHEET_SYNC_URL");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || !sheetUrl) {
    return jsonResponse({ error: "Roster sync is not configured" }, 503);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization }
  });
  if (!userResponse.ok) return jsonResponse({ error: "A valid signed-in account is required" }, 401);

  const user = await userResponse.json();
  if (!user.email || !user.email_confirmed_at) {
    return jsonResponse({ error: "Confirm the account email before syncing the roster" }, 403);
  }

  const sheetResponse = await fetch(sheetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: authorization.slice("Bearer ".length) })
  });
  const sheetResult = await sheetResponse.json().catch(() => ({ ok: false }));
  if (!sheetResponse.ok || !sheetResult.ok) {
    return jsonResponse({ error: "Google Sheet sync failed" }, 502);
  }

  return jsonResponse({ ok: true });
});