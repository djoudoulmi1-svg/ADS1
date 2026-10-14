import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://djoudoulmi1-svg.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
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
  if (request.headers.get("Origin") && request.headers.get("Origin") !== allowedOrigin) {
    return jsonResponse({ error: "Origin not allowed" }, 403);
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Admin service is not configured" }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const caller = userData.user;
  if (userError || !caller || !caller.email_confirmed_at) {
    return jsonResponse({ error: "A confirmed signed-in account is required" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: adminRow, error: adminError } = await adminClient
    .from("site_admins")
    .select("user_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (adminError) {
    console.error("Could not verify the administrator role:", adminError.message);
    return jsonResponse({ error: "Admin setup is incomplete" }, 503);
  }
  const { data: ownerRow, error: ownerError } = await adminClient
    .from("site_owners")
    .select("user_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (ownerError) {
    console.error("Could not verify the site owner:", ownerError.message);
    return jsonResponse({ error: "Administrator setup is incomplete" }, 503);
  }
  const callerIsOwner = Boolean(ownerRow);
  if (!adminRow && !callerIsOwner) return jsonResponse({ error: "Administrator access is required" }, 403);

  const { data: disabledCaller } = await adminClient
    .from("disabled_users")
    .select("user_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (disabledCaller) return jsonResponse({ error: "This account is disabled" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (body.action === "set-chapter-visibility") {
    const chapterId = String(body.chapterId || "");
    const visible = body.visible;
    if (typeof visible !== "boolean") {
      return jsonResponse({ error: "A chapter visibility status is required" }, 400);
    }
    if (chapterId === "1" || chapterId === "2") {
      const { error } = visible
        ? await adminClient.from("removed_chapters").delete().eq("chapter_id", chapterId)
        : await adminClient.from("removed_chapters").upsert(
            { chapter_id: chapterId, removed_by: caller.id },
            { onConflict: "chapter_id" }
          );
      if (error) {
        console.error("Could not update bundled chapter visibility:", error.message);
        return jsonResponse({ error: "Could not update this chapter's visibility" }, 500);
      }
      return jsonResponse({ ok: true, chapterId, visible });
    }
    if (!/^extra-(?:[3-9]|[1-9][0-9])(?:-[a-f0-9]{20})?$/i.test(chapterId)) {
      return jsonResponse({ error: "This chapter cannot be changed here" }, 400);
    }
    const { data: changedChapters, error: chapterError } = await adminClient
      .from("chapter_catalog")
      .update({ available: visible })
      .eq("id", chapterId)
      .select("id");
    if (chapterError) {
      console.error("Could not update uploaded chapter visibility:", chapterError.message);
      return jsonResponse({ error: "Could not update this chapter's visibility" }, 500);
    }
    if (!changedChapters?.length) return jsonResponse({ error: "Uploaded chapter not found" }, 404);
    return jsonResponse({ ok: true, chapterId, visible });
  }

  if (body.action === "delete-chapter") {
    const chapterId = String(body.chapterId || "");
    // Only uploaded chapters can be deleted. Bundled chapters 1 and 2 live in
    // the repository and can only be hidden.
    if (!/^extra-(?:[3-9]|[1-9][0-9])(?:-[a-f0-9]{20})?$/i.test(chapterId)) {
      return jsonResponse({ error: "Only uploaded chapters can be deleted" }, 400);
    }
    const { data: chapterRow, error: lookupError } = await adminClient
      .from("chapter_catalog")
      .select("id, file_path")
      .eq("id", chapterId)
      .maybeSingle();
    if (lookupError) {
      console.error("Could not look up the chapter:", lookupError.message);
      return jsonResponse({ error: "Could not delete this chapter" }, 500);
    }
    if (!chapterRow) return jsonResponse({ error: "Uploaded chapter not found" }, 404);

    if (chapterRow.file_path) {
      const { error: storageError } = await adminClient.storage
        .from("course-chapters")
        .remove([chapterRow.file_path]);
      if (storageError) {
        console.error("Could not remove the chapter file:", storageError.message);
        return jsonResponse({ error: "Could not delete the chapter file" }, 500);
      }
    }
    const { error: deleteError } = await adminClient
      .from("chapter_catalog")
      .delete()
      .eq("id", chapterId);
    if (deleteError) {
      console.error("Could not delete the chapter record:", deleteError.message);
      return jsonResponse({ error: "The file was removed, but the chapter record needs a retry" }, 500);
    }
    return jsonResponse({ ok: true, chapterId });
  }

  if (body.action === "list-users") {
    const { data: userResult, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (listError) {
      console.error("Could not list users:", listError.message);
      return jsonResponse({ error: "Could not load student accounts" }, 500);
    }

    const [{ data: profiles, error: profileError }, { data: disabledRows, error: disabledError }, { data: adminRows, error: adminsError }, { data: ownerRows, error: ownersError }] = await Promise.all([
      adminClient.from("profiles").select("user_id, display_name"),
      adminClient.from("disabled_users").select("user_id"),
      adminClient.from("site_admins").select("user_id"),
      adminClient.from("site_owners").select("user_id")
    ]);
    if (profileError || disabledError || adminsError || ownersError) {
      console.error("Could not load account details");
      return jsonResponse({ error: "Could not load student account details" }, 500);
    }

    const names = new Map<string, string>((profiles || []).map((profile: { user_id: string; display_name: string }) => [profile.user_id, profile.display_name]));
    const disabledIds = new Set((disabledRows || []).map(row => row.user_id));
    const adminIds = new Set((adminRows || []).map(row => row.user_id));
    const ownerIds = new Set((ownerRows || []).map(row => row.user_id));
    const users = (userResult.users || []).map(user => ({
      userId: user.id,
      email: user.email || "",
      displayName: names.get(user.id) || user.user_metadata?.display_name || "",
      disabled: disabledIds.has(user.id),
      administrator: adminIds.has(user.id) && !ownerIds.has(user.id),
      owner: ownerIds.has(user.id),
      confirmed: Boolean(user.email_confirmed_at)
    })).sort((a, b) => a.email.localeCompare(b.email));

    return jsonResponse({ users });
  }

  if (body.action === "set-admin-status") {
    if (!callerIsOwner) return jsonResponse({ error: "Only the site owner can appoint administrators" }, 403);
    const targetUserId = String(body.userId || "");
    const administrator = body.administrator;
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId) || typeof administrator !== "boolean") {
      return jsonResponse({ error: "A valid account and administrator status are required" }, 400);
    }
    const { data: targetOwner, error: targetOwnerError } = await adminClient
      .from("site_owners")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetOwnerError) return jsonResponse({ error: "Could not verify the target account" }, 500);
    if (targetOwner) return jsonResponse({ error: "The site owner role cannot be changed here" }, 403);

    const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetError || !target.user) return jsonResponse({ error: "Account not found" }, 404);
    if (administrator && !target.user.email_confirmed_at) {
      return jsonResponse({ error: "The account must confirm its email before becoming an administrator" }, 400);
    }
    if (administrator) {
      const { data: disabledTarget, error: disabledError } = await adminClient
        .from("disabled_users")
        .select("user_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (disabledError) return jsonResponse({ error: "Could not verify account status" }, 500);
      if (disabledTarget) return jsonResponse({ error: "Reactivate this account before granting administrator access" }, 400);
      const { error } = await adminClient.from("site_admins").upsert({ user_id: targetUserId }, { onConflict: "user_id" });
      if (error) return jsonResponse({ error: "Could not grant administrator access" }, 500);
    } else {
      const { error } = await adminClient.from("site_admins").delete().eq("user_id", targetUserId);
      if (error) return jsonResponse({ error: "Could not remove administrator access" }, 500);
    }
    return jsonResponse({ ok: true, administrator });
  }

  if (body.action === "set-user-active") {
    const targetUserId = String(body.userId || "");
    const active = body.active;
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId) || typeof active !== "boolean") {
      return jsonResponse({ error: "A valid account and status are required" }, 400);
    }
    if (targetUserId === caller.id && !active) {
      return jsonResponse({ error: "You cannot disable your own administrator account" }, 400);
    }

    const { data: targetOwner, error: ownerTargetError } = await adminClient
      .from("site_owners")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (ownerTargetError) return jsonResponse({ error: "Could not verify the target account" }, 500);
    if (targetOwner) return jsonResponse({ error: "The site owner account cannot be disabled here" }, 403);

    const { data: targetAdmin, error: targetAdminError } = await adminClient
      .from("site_admins")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetAdminError) return jsonResponse({ error: "Could not verify the target account" }, 500);
    if (targetAdmin) return jsonResponse({ error: "Administrator accounts cannot be disabled here" }, 403);

    if (active) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none"
      });
      if (authError) return jsonResponse({ error: "Could not reactivate this account" }, 500);
      const { error: statusError } = await adminClient.from("disabled_users").delete().eq("user_id", targetUserId);
      if (statusError) return jsonResponse({ error: "Account reactivated, but access status needs a retry" }, 500);
    } else {
      const { error: statusError } = await adminClient.from("disabled_users").upsert({
        user_id: targetUserId,
        disabled_by: caller.id,
        disabled_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (statusError) return jsonResponse({ error: "Could not update account access" }, 500);
      const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h"
      });
      if (authError) {
        await adminClient.from("disabled_users").delete().eq("user_id", targetUserId);
        return jsonResponse({ error: "Could not disable this account" }, 500);
      }
    }

    return jsonResponse({ ok: true, active });
  }

  return jsonResponse({ error: "Unknown admin action" }, 400);
});

