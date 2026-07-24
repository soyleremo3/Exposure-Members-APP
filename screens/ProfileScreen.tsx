// Your own profile: photo, editable fields, appearance, notifications, sign out.
// Laid out as three cards matching the website's profile page (Account, Edit
// Profile, Membership) — see PROJECT.md §5 for the screenshot reference.
//
// IMPORTANT — App Store rule: NO subscription, billing, or payment UI in
// this app, ever. Apple requires in-app purchases to go through their IAP
// system (with their 30% cut), and even LINKING to an external payment page
// can get the app rejected. Membership and billing live on the website only.
// Do not add "manage subscription", prices, or Stripe links here. The
// Membership card below deliberately stops at Status/Plan/Member since.
//
// The field labels below are NOT the column names. This backend reuses three
// columns for something else entirely — `bio` holds the current occupation,
// `twitter` the area of interest, `instagram` the educational background — so
// the labels match the website's form, not the database. `website` is absent
// on purpose: it stores the Refer a Friend payload. See API.md → Profile.
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, readableError, updateProfile, uploadAvatar } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatMonthYear } from '../lib/format';
import { BRAND_BLUE, BRAND_CREAM, useTheme, useThemeColors } from '../lib/theme';
import type { ThemePref } from '../lib/theme';
import type { ProfilePatch, SelfMember } from '../types';
import Avatar from '../components/Avatar';
import { ErrorNotice, Loading } from '../components/Feedback';

type FieldDef = {
  key: keyof ProfilePatch;
  label: string;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'phone-pad' | 'url';
};

// Rows drive the Edit Profile layout: a row with two fields renders as two
// columns, a row with one spans the full width — matching the website's form.
const FIELD_ROWS: FieldDef[][] = [
  [
    { key: 'name', label: 'Full Name', placeholder: 'Your name', maxLength: 120 },
    { key: 'location', label: 'Location', placeholder: 'Istanbul, Turkey' },
  ],
  [
    { key: 'phone', label: 'Phone', placeholder: '+90 555 000 00 00', maxLength: 40, keyboardType: 'phone-pad' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/...', keyboardType: 'url' },
  ],
  [{ key: 'github', label: 'GitHub', placeholder: 'github.com/...', keyboardType: 'url' }],
  // `bio` — the occupation, not a life story. 280 chars server-side.
  [
    {
      key: 'bio',
      label: 'Current Occupation',
      placeholder: 'Building a SaaS product…',
      multiline: true,
      maxLength: 280,
    },
  ],
  [
    { key: 'occupation_link', label: 'Relevant Link (optional)', placeholder: 'yourproduct.com', keyboardType: 'url' },
    // `twitter` is plain text here — no URL keyboard.
    { key: 'twitter', label: 'Area of Interest', placeholder: 'AI, GTM, Vibe Coding…' },
  ],
  // `instagram` is plain text here — no URL keyboard.
  [{ key: 'instagram', label: 'Educational Background', placeholder: 'BSc Computer Science, Stanford…' }],
  [
    {
      key: 'favorite_resource',
      label: 'Favorite Read / Video / Person / Source',
      placeholder: 'Zero to One, Lex Fridman…',
      multiline: true,
    },
  ],
];

const ALL_FIELDS = FIELD_ROWS.flat();

// `member_types` is a pick-up-to-3 chip set on the website, not free text.
const BACKGROUND_OPTIONS = ['Tech', 'Business', 'Design', 'Finance', 'Marketing', 'Strategy', 'Operations'];
const MAX_BACKGROUNDS = 3;

// Every text field starts as a string, so the form state is a flat map.
type FormState = Record<string, string>;

function formFrom(member: SelfMember): FormState {
  const form: FormState = {};
  for (const field of ALL_FIELDS) {
    const value = member[field.key as keyof SelfMember];
    form[field.key] = value == null ? '' : String(value);
  }
  // member_types can be an array on some accounts — join it back so it saves
  // in the comma format the server stores.
  const types = member.member_types;
  form.member_types = Array.isArray(types) ? types.join(', ') : types == null ? '' : String(types);
  return form;
}

export default function ProfileScreen() {
  const c = useThemeColors();
  const [member, setMember] = useState<SelfMember | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getProfile();
      setMember(data.member);
      setForm(formFrom(data.member));
      setError('');
    } catch (e) {
      setError(readableError(e, 'Failed to load profile.'));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      // Send "" for cleared fields — the API treats empty string as "clear
      // this", which is what an emptied text box should mean.
      const patch: ProfilePatch = {};
      for (const field of ALL_FIELDS) {
        (patch as Record<string, unknown>)[field.key] = form[field.key]?.trim() ?? '';
      }
      // member_types: API.md doesn't document the PATCH shape, only that GET
      // returns a comma-separated string (see PROJECT.md §4.3). Sending it
      // back as that same string is an assumption, not a confirmed contract —
      // if this 400s on a real account, switch to an array and update API.md.
      patch.member_types = form.member_types?.trim() ?? '';
      const data = await updateProfile(patch);
      setMember(data.member);
      setForm(formFrom(data.member));
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      setError(readableError(e, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      // The server caps uploads at 5 MB, so compress before sending.
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(true);
    setError('');
    try {
      const { url } = await uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      // The server already saved it to the profile; update locally so the
      // new photo shows without a round trip.
      setMember((prev) => (prev ? { ...prev, avatar_url: url } : prev));
    } catch (e) {
      setError(readableError(e, 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  function toggleBackground(option: string) {
    const current = (form.member_types ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    let next: string[];
    if (current.includes(option)) next = current.filter((s) => s !== option);
    else if (current.length >= MAX_BACKGROUNDS) return; // cap, like the website
    else next = [...current, option];
    setForm((prev) => ({ ...prev, member_types: next.join(', ') }));
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'You will need a new email code to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      // signOut clears the stored session; App.tsx hears SIGNED_OUT and
      // swaps the login screen back in.
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) return <Loading />;

  const selectedBackgrounds = (form.member_types ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
      >
        {/* ACCOUNT */}
        <Card>
          <View className="flex-row items-center">
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} disabled={uploading}>
              <Avatar uri={member?.avatar_url} name={member?.name} size={56} />
            </TouchableOpacity>
            <View className="ml-3 flex-1">
              <Text numberOfLines={1} className="text-[16px] font-bold text-body">
                {member?.name || '—'}
              </Text>
              {member?.email ? (
                <Text numberOfLines={1} className="mt-0.5 text-[13px] text-faint">
                  {member.email}
                </Text>
              ) : null}
            </View>
            <StatusBadge status={member?.subscription_status} />
          </View>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading} className="mt-3 self-start">
            {uploading ? (
              <ActivityIndicator color={BRAND_BLUE} />
            ) : (
              <Text className="text-[13px] font-semibold text-accent-link">Change photo</Text>
            )}
          </TouchableOpacity>
        </Card>

        {error ? <ErrorNotice message={error} /> : null}

        <Text className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-faint">
          Appearance
        </Text>
        <ThemeSelector />

        {/* EDIT PROFILE */}
        <Card title="Edit Profile">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Background
            </Text>
            <Text className="text-[11px] text-faint">Pick up to {MAX_BACKGROUNDS}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {BACKGROUND_OPTIONS.map((option) => {
              const selected = selectedBackgrounds.includes(option);
              const maxed = selectedBackgrounds.length >= MAX_BACKGROUNDS && !selected;
              return (
                <TouchableOpacity
                  key={option}
                  className={`rounded-full border px-3.5 py-2 ${
                    selected
                      ? 'border-brand-blue bg-brand-blue'
                      : `border-hairline bg-surface-2 ${maxed ? 'opacity-40' : ''}`
                  }`}
                  activeOpacity={0.8}
                  disabled={maxed || saving}
                  onPress={() => toggleBackground(option)}
                >
                  <Text
                    className={`text-[12px] font-medium ${
                      selected ? 'text-brand-cream' : 'text-muted'
                    }`}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {FIELD_ROWS.map((row, i) => (
            <View key={i} className="flex-row gap-3">
              {row.map((field) => (
                <FieldInput
                  key={String(field.key)}
                  field={field}
                  value={form[field.key] ?? ''}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, [field.key]: text }))}
                  disabled={saving}
                />
              ))}
            </View>
          ))}

          <TouchableOpacity
            className="mt-5 items-center rounded-full bg-brand-blue py-4"
            activeOpacity={0.85}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={BRAND_CREAM} />
            ) : (
              <Text className="text-base font-bold text-brand-cream">Save changes</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* MEMBERSHIP */}
        <Card title="Membership">
          <MembershipRow label="Status" value={member?.subscription_status || '—'} />
          <MembershipRow label="Plan" value={member?.member_category || '—'} />
          <MembershipRow
            label="Member since"
            value={member?.created_at ? formatMonthYear(member.created_at) : '—'}
            last
          />
        </Card>

        <TouchableOpacity className="mt-6 items-center py-2" onPress={confirmSignOut}>
          <Text className={`text-[15px] font-semibold ${c.isDark ? 'text-red-400' : 'text-red-600'}`}>
            Sign out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Shared card shell for Account / Edit Profile / Membership — a titled block
// gets a header row, an untitled one (Account) just wraps its children.
function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="mt-5 rounded-2xl border border-hairline bg-surface p-4">
      {title ? (
        <Text className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-faint">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// Green "Active" when the subscription is active; otherwise a neutral pill
// with whatever text the backend sent, unmodified — other statuses aren't
// documented, so nothing here should guess a friendlier label for them.
function StatusBadge({ status }: { status?: string | null }) {
  const c = useThemeColors();
  const active = status === 'active';
  const box = active ? (c.isDark ? 'bg-green-500/10' : 'bg-green-50') : 'bg-chip';
  const text = active ? (c.isDark ? 'text-green-400' : 'text-green-700') : 'text-muted';
  const dot = active ? '#22C55E' : c.faint;
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${box}`}>
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      <Text className={`text-[11px] font-semibold ${text}`}>{active ? 'Active' : status || 'Unknown'}</Text>
    </View>
  );
}

function MembershipRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const c = useThemeColors();
  return (
    <View
      className="flex-row items-center justify-between py-2.5"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: c.hairline }}
    >
      <Text className="text-[13px] text-faint">{label}</Text>
      <Text className="text-[14px] font-semibold text-body">{value}</Text>
    </View>
  );
}

// One labelled text input, used both full-width and side-by-side (see
// FIELD_ROWS) — `flex-1` makes a two-field row split evenly.
function FieldInput({
  field,
  value,
  onChangeText,
  disabled,
}: {
  field: FieldDef;
  value: string;
  onChangeText: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <View className="mt-4 flex-1">
      <Text className="mb-1.5 text-[13px] font-semibold text-muted">{field.label}</Text>
      <TextInput
        className={`rounded-xl border border-hairline bg-surface-2 px-3.5 py-3 text-[15px] text-body ${
          field.multiline ? 'h-24' : ''
        }`}
        value={value}
        onChangeText={onChangeText}
        placeholder={field.placeholder}
        placeholderTextColor="#a1a1aa"
        multiline={field.multiline}
        textAlignVertical={field.multiline ? 'top' : 'center'}
        maxLength={field.maxLength}
        keyboardType={field.keyboardType ?? 'default'}
        autoCapitalize={field.keyboardType === 'url' ? 'none' : 'sentences'}
        autoCorrect={field.keyboardType !== 'url'}
        editable={!disabled}
      />
    </View>
  );
}

// Light / Dark / System, persisted to storage. Driven by our own ThemeProvider
// (see lib/theme.tsx) — 'system' hands control back to the phone. Default is
// dark. Not part of the website; kept as its own section per user request
// (PROJECT.md §4.13).
const THEME_OPTIONS: { key: ThemePref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

function ThemeSelector() {
  const { pref, setPref } = useTheme();
  const c = useThemeColors();

  return (
    <View className="flex-row gap-2 rounded-2xl border border-hairline bg-surface p-1.5">
      {THEME_OPTIONS.map((option) => {
        const active = pref === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 ${
              active ? 'bg-brand-blue' : ''
            }`}
            activeOpacity={0.8}
            onPress={() => setPref(option.key)}
          >
            <Ionicons name={option.icon} size={15} color={active ? BRAND_CREAM : c.faint} />
            <Text
              className={`text-[13px] font-semibold ${active ? 'text-brand-cream' : 'text-muted'}`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
