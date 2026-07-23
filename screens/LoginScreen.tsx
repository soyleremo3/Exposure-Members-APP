// Login: two steps, no passwords.
//   Step 1 — member types their email → we POST it to the Exposure API,
//            which emails them a login code (Supabase email OTP; the same
//            code works on the website).
//   Step 2 — member types the code → we verify it directly with Supabase.
//
// On success Supabase stores a persistent session and fires SIGNED_IN, which
// App.tsx is listening for — so this screen doesn't navigate anywhere itself.
// It just stops being rendered.
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE } from '../lib/config';
import { supabase } from '../lib/supabase';
import { BRAND_CREAM } from '../lib/theme';

// The code length is NOT fixed at 6. Real logins have arrived with 8 digits,
// so we accept anything from 6 to 10 and let Supabase reject a wrong one.
// Hardcoding `length === 6` locks real members out.
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // No Authorization header here — the user isn't logged in yet.
      const res = await fetch(`${API_BASE}/api/members/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.status === 429) {
        setError('Too many attempts — please wait a minute and try again.');
        return;
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        return;
      }
      // The server responds { ok: true } even for unknown emails, so nobody
      // can use this form to check who is a member. That means we can't tell
      // the user "email not found" — just point them at their inbox.
      setStep('code');
      Keyboard.dismiss();
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    // Pasting from an email can carry spaces, dashes or a trailing newline,
    // so strip everything that isn't a digit before checking the length.
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length < MIN_CODE_LENGTH) {
      setError('Enter the code from your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Verify with Supabase directly (the code came from Supabase's email).
      // On success this stores a session; App.tsx takes over from there.
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleaned,
        type: 'email',
      });
      if (otpError) {
        setError('That code didn’t work. Check it, or go back and request a new one.');
      }
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1 justify-center px-7"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text className="text-center text-4xl font-black text-body">Exposure</Text>
        <Text className="mb-8 mt-2 text-center text-[15px] text-faint">
          For existing Exposure members.
        </Text>

        {step === 'email' ? (
          <>
            <TextInput
              className="rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-base text-body"
              placeholder="you@example.com"
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={sendCode}
              editable={!busy}
            />
            <TouchableOpacity
              className="mt-3.5 items-center rounded-full bg-brand-blue py-4"
              activeOpacity={0.85}
              onPress={sendCode}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={BRAND_CREAM} />
              ) : (
                <Text className="text-base font-bold text-brand-cream">Send login code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className="mb-4 text-center text-sm text-faint">
              If {email.trim()} is a member, we’ve emailed a login code. Check your inbox
              (and spam folder).
            </Text>
            <TextInput
              className="rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-center text-2xl tracking-[8px] text-body"
              placeholderTextColor="#a1a1aa"
              keyboardType="number-pad"
              maxLength={MAX_CODE_LENGTH}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={verifyCode}
              editable={!busy}
            />
            <TouchableOpacity
              className="mt-3.5 items-center rounded-full bg-brand-blue py-4"
              activeOpacity={0.85}
              onPress={verifyCode}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={BRAND_CREAM} />
              ) : (
                <Text className="text-base font-bold text-brand-cream">Verify code</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-4"
              onPress={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
              disabled={busy}
            >
              <Text className="text-center text-sm text-accent-link">Use a different email</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? (
          <Text className="mt-4 text-center text-sm text-red-600">{error}</Text>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
