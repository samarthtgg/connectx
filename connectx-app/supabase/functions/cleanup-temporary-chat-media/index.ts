const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-connectx-cleanup-secret",
};

type MediaRow = { id: string; media_path: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const expected = Deno.env.get("CONNECTX_CLEANUP_SECRET");
  const supplied = req.headers.get("x-connectx-cleanup-secret");
  if (!expected || !supplied || supplied !== expected) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Server configuration missing", { status: 500, headers: corsHeaders });
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const bucket = "connectx-temporary-chat-media";
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
  const results = {
    direct_deleted: 0,
    group_deleted: 0,
    errors: [] as string[],
  };

  async function cleanTable(table: "messages" | "chat_group_messages", label: string) {
    const query = new URLSearchParams({
      select: "id,media_path",
      media_path: "not.is.null",
      media_expired: "eq.false",
      media_expires_at: `lte.${new Date().toISOString()}`,
      limit: "500",
    });

    const listResponse = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, {
      headers,
    });
    if (!listResponse.ok) {
      results.errors.push(`${label} query: ${listResponse.status} ${await listResponse.text()}`);
      return;
    }

    const rows = (await listResponse.json()) as MediaRow[];
    for (const row of rows) {
      const encodedPath = row.media_path.split("/").map(encodeURIComponent).join("/");
      const deleteResponse = await fetch(
        `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
        { method: "DELETE", headers },
      );

      // A missing object is already in the desired deleted state.
      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        results.errors.push(
          `${label} storage ${row.id}: ${deleteResponse.status} ${await deleteResponse.text()}`,
        );
        continue;
      }

      const updateResponse = await fetch(
        `${baseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(row.id)}&media_expired=eq.false`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            media_path: null,
            media_expired: true,
            content: "This photo or video has expired.",
          }),
        },
      );

      if (!updateResponse.ok) {
        results.errors.push(
          `${label} update ${row.id}: ${updateResponse.status} ${await updateResponse.text()}`,
        );
      } else if (label === "direct") {
        results.direct_deleted++;
      } else {
        results.group_deleted++;
      }
    }
  }

  await cleanTable("messages", "direct");
  await cleanTable("chat_group_messages", "group");

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: results.errors.length ? 207 : 200,
  });
});
