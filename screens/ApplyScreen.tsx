// Public "Apply to join" form — no session, no Authorization header. Fields,
// limits and validation mirror the real backend 1:1 (app/api/applications/
// route.ts in github.com/onurrcelik/Exposure, verified 2026-07-24), not the
// screenshot: the site collects five essay questions and an optional
// referral field beyond what's visible in a quick look. See API.md → Apply.
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { readableError, submitApplication } from '../lib/api';
import { BRAND_CREAM, useThemeColors } from '../lib/theme';
import type { ApplicationDraft } from '../types';

// Same taxonomy the website's member-type modal offers on the apply form —
// unrelated to the Profile screen's "Background" chips (different field,
// different options).
const MEMBER_TYPES = [
  'Game Developer',
  'App Developer',
  'Venture Capitalist',
  'Freelancer',
  'Solopreneur',
  'Hyper-growth Founder',
  'Content Engineer',
  'Applied AI Builder',
];

const MOTIVATION_MAX = 500;
const ESSAY_MAX = 300;
const MIN_AGE = 16;
const MAX_AGE = 99;

// Applicants without a GitHub type this instead of a URL — a real backend
// rule (app/api/applications/route.ts), not a client-only nicety.
const NO_GITHUB_ANSWERS = ['no', 'none', 'n/a', 'na'];

const NAME_MAX = 120;
const PHONE_MAX = 40;
const LOCATION_MAX = 120;
const OCCUPATION_MAX = 120;
const REFERRAL_MAX = 200;
const URL_MAX = 500;

type FormState = ApplicationDraft;

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  age: '',
  linkedin: '',
  github: '',
  occupation: '',
  companyLink: '',
  location: '',
  motivation: '',
  impressiveProject: '',
  unusuallyGoodAt: '',
  approachedDifferently: '',
  tenYearVision: '',
  referral: '',
  memberTypes: [],
};

// Mirrors the server's own check (app/lib/request-security.ts → isLikelyUrl)
// exactly, so a field that passes here passes there too.
function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Client-side pass of the same rules the server enforces (plus the
// member-type check, which is a website-only client guard — the server just
// requires the joined string to be non-empty). Catches most mistakes before
// a round trip; the server has the final word regardless.
function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'Full Name is required.';
  if (!form.email.trim()) return 'Email is required.';
  if (!form.phone.trim()) return 'Phone is required.';
  if (!form.location.trim()) return 'Location is required.';
  if (!form.age.trim()) return 'Age is required.';
  const age = Number(form.age);
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    return `Age must be a whole number between ${MIN_AGE} and ${MAX_AGE}.`;
  }
  if (!form.occupation.trim()) return 'Occupation is required.';
  if (!form.companyLink.trim() || !isLikelyUrl(form.companyLink)) {
    return 'Valid company or project URL is required.';
  }
  if (!form.linkedin.trim() || !isLikelyUrl(form.linkedin)) {
    return 'Valid LinkedIn URL is required.';
  }
  const github = form.github.trim();
  const hasNoGithub = NO_GITHUB_ANSWERS.includes(github.toLowerCase());
  if (!github || (!hasNoGithub && !isLikelyUrl(github))) {
    return 'GitHub must be a full URL starting with https://, or "no" if you don’t have one.';
  }
  if (!form.motivation.trim()) return 'Please share your motivation.';
  if (form.motivation.length > MOTIVATION_MAX) {
    return `Your motivation must be ${MOTIVATION_MAX} characters or fewer.`;
  }
  const essays = [form.impressiveProject, form.unusuallyGoodAt, form.approachedDifferently, form.tenYearVision];
  if (essays.some((v) => !v.trim())) return 'Please answer all four questions.';
  if (essays.some((v) => v.length > ESSAY_MAX)) {
    return `Each answer must be ${ESSAY_MAX} characters or fewer.`;
  }
  if (form.memberTypes.length === 0) return 'Please select at least one member type.';
  return null;
}

export default function ApplyScreen() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (success) setSuccess(false);
  }

  function toggleMemberType(type: string) {
    setForm((prev) => ({
      ...prev,
      memberTypes: prev.memberTypes.includes(type)
        ? prev.memberTypes.filter((t) => t !== type)
        : [...prev.memberTypes, type],
    }));
    if (success) setSuccess(false);
  }

  async function handleSubmit() {
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      setSuccess(false);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitApplication({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        age: form.age.trim(),
        linkedin: form.linkedin.trim(),
        github: form.github.trim(),
        occupation: form.occupation.trim(),
        companyLink: form.companyLink.trim(),
        location: form.location.trim(),
        motivation: form.motivation.trim(),
        impressiveProject: form.impressiveProject.trim(),
        unusuallyGoodAt: form.unusuallyGoodAt.trim(),
        approachedDifferently: form.approachedDifferently.trim(),
        tenYearVision: form.tenYearVision.trim(),
        referral: form.referral.trim(),
      });
      // Matches the website: clear the form and show an inline success
      // message on the same screen, no navigation away.
      setForm(EMPTY_FORM);
      setSuccess(true);
    } catch (e) {
      setError(readableError(e, 'Failed to submit application.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row gap-3">
          <Field
            label="Full Name"
            required
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="John Doe"
            maxLength={NAME_MAX}
            disabled={submitting}
          />
          <Field
            label="Email"
            required
            value={form.email}
            onChangeText={(v) => set('email', v)}
            keyboardType="email-address"
            disabled={submitting}
          />
        </View>

        <View className="flex-row gap-3">
          <Field
            label="Phone"
            required
            value={form.phone}
            onChangeText={(v) => set('phone', v)}
            placeholder="+1 (555) 000-0000"
            keyboardType="phone-pad"
            maxLength={PHONE_MAX}
            disabled={submitting}
          />
          <Field
            label="Location"
            required
            value={form.location}
            onChangeText={(v) => set('location', v)}
            placeholder="City, Country"
            maxLength={LOCATION_MAX}
            disabled={submitting}
          />
        </View>

        <View className="flex-row gap-3">
          <Field
            label="Age"
            required
            value={form.age}
            onChangeText={(v) => set('age', v.replace(/[^0-9]/g, ''))}
            placeholder="27"
            keyboardType="number-pad"
            maxLength={2}
            disabled={submitting}
          />
          <Field
            label="Occupation"
            required
            value={form.occupation}
            onChangeText={(v) => set('occupation', v)}
            placeholder="Founder at ..."
            maxLength={OCCUPATION_MAX}
            disabled={submitting}
          />
        </View>

        <Field
          label="Company / Project Link"
          required
          value={form.companyLink}
          onChangeText={(v) => set('companyLink', v)}
          placeholder="https://"
          keyboardType="url"
          maxLength={URL_MAX}
          disabled={submitting}
        />

        <View className="flex-row gap-3">
          <Field
            label="LinkedIn"
            required
            value={form.linkedin}
            onChangeText={(v) => set('linkedin', v)}
            placeholder="https://linkedin.com/in/yourprofile"
            keyboardType="url"
            maxLength={URL_MAX}
            disabled={submitting}
          />
          <Field
            label="GitHub"
            required
            value={form.github}
            onChangeText={(v) => set('github', v)}
            placeholder={'https://github.com/you — or "no"'}
            keyboardType="url"
            maxLength={URL_MAX}
            disabled={submitting}
          />
        </View>

        <EssayField
          label="What is your motivation?"
          value={form.motivation}
          max={MOTIVATION_MAX}
          placeholder="Why do you want to join Exposure, and what do you want to get out of it?"
          onChangeText={(v) => set('motivation', v)}
          disabled={submitting}
        />
        <EssayField
          label="Describe your most impressive project or achievement"
          value={form.impressiveProject}
          max={ESSAY_MAX}
          placeholder="What did you build or solve? What was your role? What did you learn?"
          onChangeText={(v) => set('impressiveProject', v)}
          disabled={submitting}
        />
        <EssayField
          label="What are you unusually good at?"
          value={form.unusuallyGoodAt}
          max={ESSAY_MAX}
          placeholder="A skill, talent, or way of thinking that sets you apart from your peers."
          onChangeText={(v) => set('unusuallyGoodAt', v)}
          disabled={submitting}
        />
        <EssayField
          label="Did you take a unique approach to a problem?"
          value={form.approachedDifferently}
          max={ESSAY_MAX}
          placeholder="What was the situation, what would others have done, what did you do differently, and what happened?"
          onChangeText={(v) => set('approachedDifferently', v)}
          disabled={submitting}
        />
        <EssayField
          label="Where do you want to be in 10 years?"
          value={form.tenYearVision}
          max={ESSAY_MAX}
          placeholder="Be specific. What actions are you taking today toward that future?"
          onChangeText={(v) => set('tenYearVision', v)}
          disabled={submitting}
        />

        <View className="mt-4">
          <Text className="mb-1.5 text-[13px] font-semibold text-muted">
            Which type of member are you? <Text className="text-red-400">*</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {MEMBER_TYPES.map((type) => {
              const selected = form.memberTypes.includes(type);
              return (
                <TouchableOpacity
                  key={type}
                  className={`rounded-full border px-3.5 py-2 ${
                    selected ? 'border-brand-blue bg-brand-blue' : 'border-hairline bg-surface-2'
                  }`}
                  activeOpacity={0.8}
                  disabled={submitting}
                  onPress={() => toggleMemberType(type)}
                >
                  <Text className={`text-[12px] font-medium ${selected ? 'text-brand-cream' : 'text-muted'}`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Field
          label="Do you have a referral from an Exposure member? (optional)"
          value={form.referral}
          onChangeText={(v) => set('referral', v)}
          placeholder="Name of the member who referred you"
          maxLength={REFERRAL_MAX}
          disabled={submitting}
        />

        {error ? <Notice tone="error" message={error} /> : null}
        {success ? (
          <Notice
            tone="success"
            message="Application received! We'll review it and reach out about next steps."
          />
        ) : null}

        <TouchableOpacity
          className="mt-5 items-center rounded-full bg-brand-blue py-4"
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={BRAND_CREAM} />
          ) : (
            <Text className="text-base font-bold text-brand-cream">Submit Application</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-4 items-center"
          onPress={() => Linking.openURL('mailto:hello@exposureai.org')}
        >
          <Text className="text-center text-[13px] text-faint">
            Having trouble? Email <Text className="text-accent-link">hello@exposureai.org</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// One labelled text input — full-width alone, half-width in a `flex-row` pair
// (matches the two-column rows on the website form).
function Field({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType,
  disabled,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'url';
  disabled?: boolean;
}) {
  const noAutoCorrect = keyboardType === 'email-address' || keyboardType === 'url';
  return (
    <View className="mt-4 flex-1">
      <Text className="mb-1.5 text-[13px] font-semibold text-muted">
        {label} {required ? <Text className="text-red-400">*</Text> : null}
      </Text>
      <TextInput
        className="rounded-xl border border-hairline bg-surface-2 px-3.5 py-3 text-[15px] text-body"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        maxLength={maxLength}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={noAutoCorrect ? 'none' : 'sentences'}
        autoCorrect={!noAutoCorrect}
        editable={!disabled}
      />
    </View>
  );
}

// Multiline field with a "142/500" counter that ambers near the limit and
// reds out at it — same thresholds as the website's TextareaField.
function EssayField({
  label,
  value,
  max,
  placeholder,
  onChangeText,
  disabled,
}: {
  label: string;
  value: string;
  max: number;
  placeholder: string;
  onChangeText: (text: string) => void;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  const warnAt = Math.floor(max * 0.9);
  const counterColor =
    value.length >= max
      ? 'text-red-500'
      : value.length >= warnAt
        ? c.isDark
          ? 'text-amber-400'
          : 'text-amber-600'
        : 'text-faint';
  return (
    <View className="mt-4">
      <View className="mb-1.5 flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[13px] font-semibold text-muted">
          {label} <Text className="text-red-400">*</Text>
        </Text>
        <Text className={`text-[11px] font-semibold ${counterColor}`}>
          {value.length}/{max}
        </Text>
      </View>
      <TextInput
        className="h-24 rounded-xl border border-hairline bg-surface-2 px-3.5 py-3 text-[15px] text-body"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        multiline
        textAlignVertical="top"
        maxLength={max}
        editable={!disabled}
      />
    </View>
  );
}

// Inline result banner. Not ErrorNotice: this needs a success variant too,
// and the read-only-account banner mechanism it once had was removed for
// good (PROJECT.md §4.11) — this is a plain, local, one-off View, not a new
// shared abstraction.
function Notice({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const c = useThemeColors();
  const box =
    tone === 'success' ? (c.isDark ? 'bg-green-500/10' : 'bg-green-50') : c.isDark ? 'bg-red-500/10' : 'bg-red-50';
  const text =
    tone === 'success' ? (c.isDark ? 'text-green-400' : 'text-green-700') : c.isDark ? 'text-red-300' : 'text-red-700';
  return (
    <View className={`mt-4 rounded-xl px-4 py-3 ${box}`}>
      <Text className={`text-sm ${text}`}>{message}</Text>
    </View>
  );
}
