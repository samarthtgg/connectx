import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-connectx-cleanup-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const expected = Deno.env.get("CONNECTX_CLEANUP_SECRET");
  const supplied = req.headers.get("x-connectx-cleanup-secret");
  if (!expected || !supplied || supplied !== expected) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Server configuration missing", { status: 500, headers: corsHeaders });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  const bucket = "connectx-temporary-chat-media";
  const results = { direct_deleted: 0, group_deleted: 0, errors: [] as string[] };

  const direct = await admin.from("messages")
    .select("id,media_path")
    .not("media_path", "is", null)
    .eq("media_expired", false)
    .lte("media_expires_at", now)
    .limit(500);

  if (direct.error) results.errors.push("direct query: " + direct.error.message);
  for (const row of direct.data ?? []) {
    const removed = await admin.storage.from(bucket).remove([row.media_path]);
    if (removed.error) { results.errors.push("direct storage " + row.id + ": " + removed.error.message); continue; }
    const updated = await admin.from("messages")
      .update({ media_path: null, media_expired: true, content: "This photo or video has expired." })
      .eq("id", row.id).eq("media_expired", false);
    if (updated.error) results.errors.push("direct update " + row.id + ": " + updated.error.message);
    else results.direct_deleted++;
  }

  const groups = await admin.from("chat_group_messages")
    .select("id,media_path")
    .not("media_path", "is", null)
    .eq("media_expired", false)
    .lte("media_expires_at", now)
    .limit(500);

  if (groups.error) results.errors.push("group query: " + groups.error.message);
  for (const row of groups.data ?? []) {
    const removed = await admin.storage.from(bucket).remove([row.media_path]);
    if (removed.error) { results.errors.push("group storage " + row.id + ": " + removed.error.message); continue; }
    const updated = await admin.from("chat_group_messages")
      .update({ media_path: null, media_expired: true, content: "This photo or video has expired." })
      .eq("id", row.id).eq("media_expired", false);
    if (updated.error) results.errors.push("group update " + row.id + ": " + updated.error.message);
    else results.group_deleted++;
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: results.errors.length ? 207 : 200,
  });
});
