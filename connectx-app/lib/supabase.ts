import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Supabase Passkeys are experimental and must also be enabled in the
// Supabase project's Authentication → Passkeys settings.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { experimental: { passkey: true } },
});
