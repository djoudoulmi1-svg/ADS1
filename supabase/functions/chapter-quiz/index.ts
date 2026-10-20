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
    return jsonResponse({ error: "A confirmed signed-in account is required" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData.user;
  if (userError || !user || !user.email_confirmed_at) return jsonResponse({ error: "Sign in with a confirmed account to use chapter quizzes" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const [{ data: disabled }, { data: deleted }] = await Promise.all([
    serviceClient.from("disabled_users").select("user_id").eq("user_id", user.id).maybeSingle(),
    serviceClient.from("deleted_user_ids").select("user_id").eq("user_id", user.id).maybeSingle()
  ]);
  if (disabled || deleted) return jsonResponse({ error: "This account is not active" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  async function visibleChapter(chapterId: string) {
    if (chapterId === "1" || chapterId === "2") {
      const { data, error } = await serviceClient.from("removed_chapters").select("chapter_id").eq("chapter_id", chapterId).maybeSingle();
      if (error) return { visible: false, error: true };
      return { visible: !data, error: false };
    }
    const { data, error } = await serviceClient.from("chapter_catalog").select("id").eq("id", chapterId).eq("available", true).maybeSingle();
    return { visible: Boolean(data), error: Boolean(error) };
  }

  if (body.action === "list") {
    const chapterId = String(body.chapterId || "");
    if (!chapterId || chapterId.length > 40) return jsonResponse({ error: "A valid chapter is required" }, 400);
    const visibility = await visibleChapter(chapterId);
    if (visibility.error) return jsonResponse({ error: "Could not verify chapter availability" }, 500);
    if (!visibility.visible) return jsonResponse({ error: "This chapter is not available" }, 404);
    const { data, error } = await serviceClient.from("chapter_quizzes")
      .select("id, chapter_id, question, options")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Could not load chapter quiz questions:", error.message);
      return jsonResponse({ error: "Could not load quiz questions" }, 500);
    }
    return jsonResponse({ quizzes: data || [] });
  }

  if (body.action === "answer") {
    const quizId = String(body.quizId || "");
    const selectedIndex = body.selectedIndex;
    if (!/^[0-9a-f-]{36}$/i.test(quizId) || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 5) {
      return jsonResponse({ error: "Choose one of the listed answers" }, 400);
    }
    const { data: quiz, error } = await serviceClient.from("chapter_quizzes")
      .select("chapter_id, options, correct_index, explanation")
      .eq("id", quizId)
      .maybeSingle();
    if (error) return jsonResponse({ error: "Could not check this answer" }, 500);
    if (!quiz) return jsonResponse({ error: "Quiz question not found" }, 404);
    const visibility = await visibleChapter(String(quiz.chapter_id));
    if (visibility.error) return jsonResponse({ error: "Could not verify chapter availability" }, 500);
    if (!visibility.visible) return jsonResponse({ error: "This chapter is not available" }, 404);
    const options = Array.isArray(quiz.options) ? quiz.options : [];
    if (selectedIndex >= options.length) return jsonResponse({ error: "Choose one of the listed answers" }, 400);
    return jsonResponse({
      ok: true,
      isCorrect: selectedIndex === quiz.correct_index,
      correctOption: options[quiz.correct_index],
      explanation: quiz.explanation || ""
    });
  }

  return jsonResponse({ error: "Unknown quiz action" }, 400);
});
