// Fill these after creating the Supabase project (see SETUP.md).
// Empty values = app runs in local mode (votes stay on this device only).
export const CONFIG = {
  SUPABASE_URL: '',        // e.g. 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',   // anon/public key from Supabase project settings
  // Optional live-score proxy (Supabase edge function wrapping football-data.org).
  // Empty = scores come from openfootball (updated ~daily).
  SCORES_URL: '',          // e.g. 'https://abcdefgh.supabase.co/functions/v1/scores'
  // Points for a correct pick.
  POINTS_GROUP: 3,
  POINTS_KO: 3,
  // How often to refresh scores + votes while the app is open (ms).
  REFRESH_MS: 60_000,
};
