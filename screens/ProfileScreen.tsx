// Your own profile: photo, editable fields, notification settings, sign out.
//
// IMPORTANT — App Store rule: NO subscription, billing, or payment UI in
// this app, ever. Apple requires in-app purchases to go through their IAP
// system (with their 30% cut), and even LINKING to an external payment page
// can get the app rejected. Membership and billing live on the website only.
// Do not add "manage subscription", prices, or Stripe links here.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getJobNotifications,
  getProfile,
  updateJobNotifications,
  updateProfile,
  uploadAvatar,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { BRAND_BLUE, BRAND_CREAM } from '../lib/theme';
import type { JobNotificationSettings, ProfilePatch, SelfMember } from '../types';
import Avatar from '../components/Avatar';
import { ErrorNotice, Loading } from '../components/Feedback';

// The editable text fields, in the order they appear. Driving the form from
// a list keeps this screen from turning into 200 lines of near-identical
// TextInputs. `key` must be a field PATCH /api/members/profile accepts.
const FIELDS: {
  key: keyof ProfilePatch;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'phone-pad' | 'url';
}[] = [
  { key: 'name', label: 'Name', maxLength: 120 },
  { key: 'bio', label: 'Bio', multiline: true, maxLength: 280 },
  { key: 'location', label: 'Location', placeholder: 'Istanbul, Turkey' },
  {
    key: 'member_types',
    label: 'What you do',
    placeholder: 'Founder, Investor',
    // Comma-separated on purpose — that's the format the server stores.
  },
  { key: 'occupation_link', label: 'Company / work link', keyboardType: 'url' },
  { key: 'linkedin', label: 'LinkedIn', keyboardType: 'url' },
  { key: 'twitter', label: 'Twitter / X', keyboardType: 'url' },
  { key: 'instagram', label: 'Instagram', keyboardType: 'url' },
  { key: 'github', label: 'GitHub', keyboardType: 'url' },
  { key: 'website', label: 'Website', keyboardType: 'url' },
  { key: 'favorite_resource', label: 'Favorite resource' },
  { key: 'phone', label: 'Phone', maxLength: 40, keyboardType: 'phone-pad' },
];

// Every text field starts as a string, so the form state is a flat map.
type FormState = Record<string, string>;

function formFrom(member: SelfMember): FormState {
  const form: FormState = {};
  for (const field of FIELDS) {
    const value = member[field.key as keyof SelfMember];
    // member_types can be an array on some accounts — join it back so the
    // text box shows the same comma format the server expects on save.
    form[field.key] = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  }
  return form;
}

export default function ProfileScreen() {
  const [member, setMember] = useState<SelfMember | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [autoOptIn, setAutoOptIn] = useState(false);
  const [notify, setNotify] = useState<JobNotificationSettings>({
    notify_jobs: false,
    notify_needs: false,
  });
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
      setAutoOptIn(!!data.member.auto_opt_in);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile.');
      return;
    }
    // Notification settings are a separate endpoint. A failure here isn't
    // worth blocking the whole screen for — the switches just stay off.
    try {
      const data = await getJobNotifications();
      setNotify(data.subscription);
    } catch {
      // ignore
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
      const patch: ProfilePatch = { auto_opt_in: autoOptIn };
      for (const field of FIELDS) {
        (patch as Record<string, unknown>)[field.key] = form[field.key]?.trim() ?? '';
      }
      const data = await updateProfile(patch);
      setMember(data.member);
      setForm(formFrom(data.member));
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
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
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // Write the switch through immediately — a settings toggle that needs a
  // separate "save" is a toggle people forget to save.
  async function toggleNotify(key: keyof JobNotificationSettings, value: boolean) {
    const previous = notify;
    setNotify({ ...notify, [key]: value });
    try {
      const data = await updateJobNotifications({ [key]: value });
      setNotify(data.subscription);
    } catch {
      setNotify(previous);
      setError('Could not update notification settings.');
    }
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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-cream"
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
        <View className="items-center">
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} disabled={uploading}>
            <Avatar uri={member?.avatar_url} name={member?.name} size={96} />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading} className="mt-2">
            {uploading ? (
              <ActivityIndicator color={BRAND_BLUE} />
            ) : (
              <Text className="text-[13px] font-semibold text-brand-blue">Change photo</Text>
            )}
          </TouchableOpacity>
          {member?.email ? (
            <Text className="mt-2 text-[13px] text-zinc-500">{member.email}</Text>
          ) : null}
        </View>

        {error ? <ErrorNotice message={error} /> : null}

        {FIELDS.map((field) => (
          <View key={String(field.key)}>
            <Text className="mb-1.5 mt-4 text-[13px] font-semibold text-zinc-600">
              {field.label}
            </Text>
            <TextInput
              className={`rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-zinc-900 ${
                field.multiline ? 'h-24' : ''
              }`}
              value={form[field.key] ?? ''}
              onChangeText={(text) => setForm((prev) => ({ ...prev, [field.key]: text }))}
              placeholder={field.placeholder}
              placeholderTextColor="#a1a1aa"
              multiline={field.multiline}
              textAlignVertical={field.multiline ? 'top' : 'center'}
              maxLength={field.maxLength}
              keyboardType={field.keyboardType ?? 'default'}
              autoCapitalize={field.keyboardType === 'url' ? 'none' : 'sentences'}
              autoCorrect={field.keyboardType !== 'url'}
              editable={!saving}
            />
          </View>
        ))}

        <Text className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
          Weekly match
        </Text>
        <Row
          label="Join every week automatically"
          hint="You'll be entered into each new matching round without opting in."
          value={autoOptIn}
          onChange={setAutoOptIn}
          disabled={saving}
        />

        <Text className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
          Job board emails
        </Text>
        <Row
          label="New job posts"
          value={notify.notify_jobs}
          onChange={(v) => toggleNotify('notify_jobs', v)}
        />
        <Row
          label="New help requests"
          value={notify.notify_needs}
          onChange={(v) => toggleNotify('notify_needs', v)}
        />

        <TouchableOpacity
          className="mt-8 items-center rounded-full bg-brand-blue py-4"
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

        <TouchableOpacity className="mt-6 items-center py-2" onPress={confirmSignOut}>
          <Text className="text-[15px] font-semibold text-red-600">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A labelled switch row. The `auto_opt_in` one saves with the form; the
// notification ones save on toggle — hence the shared shape but separate
// handlers above.
function Row({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="mb-2 flex-row items-center rounded-xl border border-black/5 bg-white px-3.5 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-[15px] text-zinc-900">{label}</Text>
        {hint ? <Text className="mt-0.5 text-[12px] text-zinc-500">{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: BRAND_BLUE, false: '#d4d4d8' }}
      />
    </View>
  );
}
