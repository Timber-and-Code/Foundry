import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iwresyrdyalwkowyxxwr.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cmVzeXJkeWFsd2tvd3l4eHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDI5NDAsImV4cCI6MjA5MDcxODk0MH0.VNpTfui51QnB5UZ6fDZKTzI6oCXasEl8WGlNHZv0lc0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
