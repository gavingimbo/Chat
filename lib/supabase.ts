import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for use in the browser (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for use in server components/actions (service role key for bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
