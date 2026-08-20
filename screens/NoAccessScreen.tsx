// Shown when someone signs in successfully but isn't an active member
// (unknown email, past member, membership not active yet).
//
// IMPORTANT — keep this screen free of ANY money talk: no price, no
// "subscribe", no "renew", no link to billing. Membership is sold on the
// website only; the app must not hint at it (App Store rule — see
// ProfileScreen and CLAUDE.md §3). The wording is deliberately neutral about
// WHY access is missing.
import { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function NoAccessScreen() {
  const [busy, setBusy] = useState(false);

  async function useDifferentEmail() {
    setBusy(true);
    // AppShell's onAuthStateChange listener already swaps the tree back to
    // the login screen the instant `session` goes null — nothing to navigate.
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView className="flex-1 justify-center bg-background px-7">
      <Text className="text-center text-4xl font-black text-body">Exposure</Text>

      <Text className="mt-10 text-center text-xl font-bold text-body">
        Account not authenticated yet
      </Text>
      <Text className="mt-3 text-center text-[15px] leading-6 text-faint">
        This email isn’t an active Exposure member account yet. If you think this is a
        mistake, get in touch with the team.
      </Text>

      <TouchableOpacity
        className="mt-8 items-center rounded-full border border-hairline bg-surface py-4"
        activeOpacity={0.85}
        onPress={useDifferentEmail}
        disabled={busy}
      >
        <Text className="text-base font-bold text-body">Use a different email</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
