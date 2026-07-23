// App-wide constants.
//
// The Supabase URL and "anon" key are PUBLIC values — the web app ships them
// in every browser page. They only let clients talk to Supabase Auth; all
// real data access goes through the Exposure API, which checks membership
// server-side. So it's fine (and normal) to hardcode them here.
//
// Nothing else belongs in this file. If a feature seems to need a secret
// key, that logic belongs on the backend, not in the app.
export const SUPABASE_URL = 'https://kewdennuetbsmgixszmj.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_cZyw46TR-DOZ98gXD1F4Yw_FmVZ7-iO';

// Flip to true while developing against a local backend (`npm run dev` in the
// Exposure repo). Note: a real phone can't reach your laptop's "localhost" —
// use your laptop's LAN IP (e.g. http://192.168.1.20:3000) if testing on-device.
const USE_LOCAL_API = false;

export const API_BASE = USE_LOCAL_API
  ? 'http://localhost:3000'
  : 'https://exposureai.org';
