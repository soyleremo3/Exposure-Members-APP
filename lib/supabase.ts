// One shared Supabase client for the whole app.
//
// We only use Supabase for AUTH (email login code + session refresh).
// All data comes from the Exposure API (see lib/api.ts) — never query
// Supabase tables directly from the app; the server enforces membership.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Session storage tradeoff: we use AsyncStorage (plain on-device storage)
    // instead of expo-secure-store because SecureStore caps values at ~2048
    // bytes on iOS and Supabase's session JSON is bigger than that. Splitting
    // it into chunks works but adds complexity. AsyncStorage is sandboxed to
    // this app, and the tokens inside are short-lived + revocable, so this is
    // an acceptable tradeoff for a simpler codebase. If you ever want to
    // harden it, look up the "chunked SecureStore adapter" pattern.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // detectSessionInUrl is a web-only feature (reads tokens out of the page
    // URL after a magic-link redirect). There is no page URL in an app.
    detectSessionInUrl: false,
  },
});

// Supabase only refreshes the access token while it thinks the app is
// "running". React Native apps get backgrounded, so we tell it explicitly:
// refresh while in the foreground, pause in the background. Without this,
// a phone that slept overnight can wake up with an expired session.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
