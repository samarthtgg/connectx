const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-connectx-cleanup-secret",
};

type MediaRow = { id: string; media_path: string };
type StorageEntry = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

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
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const results = {
    direct_deleted: 0,
    group_deleted: 0,
    orphan_objects_deleted: 0,
    errors: [] as string[],
  };

  async function cleanTable(table: "messages" | "chat_group_messages", label: string) {
    const cutoff = new Date().toISOString();
    let cursor = "";

    // Keyset pagination keeps later pages stable while rows are updated below.
    while (true) {
      const query = new URLSearchParams({
        select: "id,media_path",
        media_path: "not.is.null",
        media_expired: "eq.false",
        media_expires_at: `lte.${cutoff}`,
        order: "id.asc",
        limit: "500",
      });
      if (cursor) query.set("id", `gt.${cursor}`);

      const listResponse = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { headers });
      if (!listResponse.ok) {
        results.errors.push(`${label} query: ${listResponse.status} ${await listResponse.text()}`);
        return;
      }

      const rows = (await listResponse.json()) as MediaRow[];
      if (!rows.length) break;

      for (const row of rows) {
        const encodedPath = row.media_path.split("/").map(encodeURIComponent).join("/");
        const deleteResponse = await fetch(
          `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
          { method: "DELETE", headers },
        );
        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          results.errors.push(`${label} storage ${row.id}: ${deleteResponse.status} ${await deleteResponse.text()}`);
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
          results.errors.push(`${label} update ${row.id}: ${updateResponse.status} ${await updateResponse.text()}`);
        } else if (label === "direct") {
          results.direct_deleted++;
        } else {
          results.group_deleted++;
        }
      }

      cursor = rows[rows.length - 1].id;
      if (rows.length < 500) break;
    }
  }
  // Also sweep the dedicated temporary bucket itself. This catches abandoned
  // uploads that never made it into a message row, which row-based cleanup misses.
  async function listAndDeleteExpired(prefix = "", depth = 0): Promise<void> {
    if (depth > 8) {
      results.errors.push(`Storage folder depth limit reached at ${prefix}`);
      return;
    }

    const expiredPaths: string[] = [];
    const childFolders = new Set<string>();
    const pageSize = 1000;
    let offset = 0;

    // Read every page before deleting anything; deleting during offset paging
    // can shift later pages and leave expired objects behind indefinitely.
    while (true) {
      const listResponse = await fetch(`${baseUrl}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          limit: pageSize,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      });
      if (!listResponse.ok) {
        results.errors.push(`Storage list ${prefix || "/"}: ${listResponse.status} ${await listResponse.text()}`);
        return;
      }

      const entries = (await listResponse.json()) as StorageEntry[];
      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id) {
          childFolders.add(path);
          continue;
        }
        const createdAt = entry.created_at || entry.updated_at;
        if (!createdAt) {
          results.errors.push(`Missing creation timestamp for ${path}; left untouched`);
          continue;
        }
        if (Date.now() - new Date(createdAt).getTime() >= 5 * 60 * 1000) {
          expiredPaths.push(path);
        }
      }

      if (entries.length < pageSize) break;
      offset += entries.length;
    }

    for (const folder of childFolders) {
      await listAndDeleteExpired(folder, depth + 1);
    }

    for (let i = 0; i < expiredPaths.length; i += 100) {
      const batch = expiredPaths.slice(i, i + 100);
      const deleteResponse = await fetch(`${baseUrl}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: batch }),
      });
      if (!deleteResponse.ok) {
        results.errors.push(`Storage batch delete: ${deleteResponse.status} ${await deleteResponse.text()}`);
      } else {
        results.orphan_objects_deleted += batch.length;
      }
    }
  }

  await cleanTable("messages", "direct");
  await cleanTable("chat_group_messages", "group");
  await listAndDeleteExpired();

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: results.errors.length ? 207 : 200,
  });
});
