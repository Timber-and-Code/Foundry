import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iwresyrdyalwkowyxxwr.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_M-VwkRcnh-qfJd4NJjQbsKA_Mu9zY07a';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
