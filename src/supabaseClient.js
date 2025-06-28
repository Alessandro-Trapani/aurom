import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Debug: Check if environment variables are being read
console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key exists:", !!supabaseAnonKey);
console.log(
  "Supabase Key length:",
  supabaseAnonKey ? supabaseAnonKey.length : 0
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
