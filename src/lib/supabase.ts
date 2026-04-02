import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  console.warn("[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — DB persistence disabled.");
}

/** Shared Supabase client for browser-side usage. */
export const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon)
  : null;
