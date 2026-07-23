// Create a post, or edit one of yours. Same form either way — the route
// param decides: no `post` means create, a `post` means edit.
//
// The length caps below are the server's (API.md). Enforcing them in the
// inputs means a member hits a character counter instead of a 400.
import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createJobPost, readableError, updateJobPost } from '../../lib/api';
import { toTypeList } from '../../lib/format';
import type { JobDraft, JobType } from '../../types';
import type { RootStackParamList } from '../../navigation';
import { PrimaryButton } from '../../components/Buttons';
import { ErrorNotice } from '../../components/Feedback';

const MAX_TITLE = 140;
const MAX_DESCRIPTION = 5000;
const MAX_LOCATION = 120;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 30;

export default function JobComposeScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'JobCompose'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const existing = route.params?.post;

  const [type, setType] = useState<JobType>(existing?.type ?? 'job');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  // Tags are stored as an array but typed as one comma-separated line —
  // a tag-chip input is a lot of UI for a field most people fill once.
  const [tagText, setTagText] = useState(toTypeList(existing?.tags).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? 'Edit post' : 'New post' });
  }, [navigation, existing]);

  async function submit() {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setError('A title and a description are required.');
      return;
    }

    const tags = toTypeList(tagText)
      .map((t) => t.slice(0, MAX_TAG_LENGTH))
      .slice(0, MAX_TAGS);

    const draft: JobDraft = {
      type,
      title: trimmedTitle,
      description: trimmedDescription,
      // The server only uses location on "job" posts, so don't send it on
      // a "need" — it would just be stored and never shown.
      ...(type === 'job' && location.trim() ? { location: location.trim() } : {}),
      ...(tags.length ? { tags } : {}),
    };

    setBusy(true);
    setError('');
    try {
      if (existing) await updateJobPost(existing.id, draft);
      else await createJobPost(draft);
      // The board and detail screens reload on focus, so going back is
      // enough to show the change.
      navigation.goBack();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-cream"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-2 text-[13px] font-semibold text-zinc-600">
          What kind of post is this?
        </Text>
        <View className="flex-row gap-2">
          <TypeOption
            label="I'm offering work"
            active={type === 'job'}
            onPress={() => setType('job')}
          />
          <TypeOption
            label="I need help"
            active={type === 'need'}
            onPress={() => setType('need')}
          />
        </View>

        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          maxLength={MAX_TITLE}
          placeholder={type === 'job' ? 'Senior React Native developer' : 'Looking for a designer'}
          editable={!busy}
        />

        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          maxLength={MAX_DESCRIPTION}
          placeholder="What the work is, what you're looking for, how to reach you."
          multiline
          editable={!busy}
        />

        {type === 'job' ? (
          <Field
            label="Location"
            value={location}
            onChange={setLocation}
            maxLength={MAX_LOCATION}
            placeholder="Istanbul, or Remote"
            editable={!busy}
          />
        ) : null}

        <Field
          label={`Tags (up to ${MAX_TAGS}, comma separated)`}
          value={tagText}
          onChange={setTagText}
          placeholder="react-native, design, part-time"
          editable={!busy}
        />

        {error ? <ErrorNotice message={error} /> : null}

        <PrimaryButton
          label={existing ? 'Save changes' : 'Post to the board'}
          busy={busy}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TypeOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-1">
      <Text
        onPress={onPress}
        className={`overflow-hidden rounded-xl border py-3 text-center text-[14px] font-semibold ${
          active
            ? 'border-brand-blue bg-brand-blue text-brand-cream'
            : 'border-black/10 bg-white text-zinc-600'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
  editable,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-1.5 text-[13px] font-semibold text-zinc-600">{label}</Text>
      <TextInput
        className={`rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-zinc-900 ${
          multiline ? 'h-40' : ''
        }`}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxLength={maxLength}
        editable={editable}
      />
      {maxLength && maxLength > 200 ? (
        <Text className="mt-1 text-right text-[11px] text-zinc-400">
          {value.length}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
}
