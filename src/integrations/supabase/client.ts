import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://zymomxrjcxxkpfjuyktv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bW9teHJqY3h4a3BmanV5a3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2OTg4MjQsImV4cCI6MjEwNTI3NDgyNH0.RhriFuY3ETbyjDghz6sy8RqUPjn6Ood_Hix_1RSYwyM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
