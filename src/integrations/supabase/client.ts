import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://kuucdtwfneakjbvquecq.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dWNkdHdmbmVha2pidnF1ZWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTMyMTAsImV4cCI6MjEwNTI4OTIxMH0.3nLbpgNFlyJbJFaFk1bT7bP5cbBpja4E510IGMQgzkY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
