// Creates one shared Supabase client for the whole site.
// Depends on config.js being loaded first, and the Supabase UMD
// script being loaded first (see the <script> tags in each HTML page).
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase library did not load. Check your internet connection.");
    return;
  }
  var cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || cfg.url.indexOf("PASTE_YOUR") === 0) {
    console.warn("Supabase is not configured yet. Edit js/config.js with your project URL and anon key.");
  }
  window.sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
})();
