// One job-board post: the full text, and whatever actions apply to you.
//
// There is no "get one post" endpoint (see API.md) — the board returns the
// whole list, so we fetch it and pick ours out. That's also what keeps the
// flags fresh: after applying, `viewer_applied` comes back true from the
// same list the board screen reads.
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  applyToJob,
  closeJobPost,
  deleteJobPost,
  getJobPosts,
  readableError,
  withdrawApplication,
} from '../../lib/api';
import { formatDate, toTypeList } from '../../lib/format';
import type { JobPost } from '../../types';
import type { RootStackParamList } from '../../navigation';
import Avatar from '../../components/Avatar';
import Chip from '../../components/Chip';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import { Empty, ErrorNotice, Loading } from '../../components/Feedback';

// Server-enforced limits (API.md). Mirrored here so the input stops the
// member at the right length instead of the request failing with a 400.
const MAX_PITCH = 1500;
const MAX_LINK = 500;

export default function JobDetailScreen() {
  const { id } = useRoute<RouteProp<RootStackParamList, 'JobDetail'>>().params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [post, setPost] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);
  const [pitch, setPitch] = useState('');
  const [link, setLink] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getJobPosts();
      setPost(data.posts.find((p) => p.id === id) ?? null);
      setError('');
    } catch (e) {
      setError(readableError(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  async function submitApplication() {
    const trimmedPitch = pitch.trim();
    if (!trimmedPitch) {
      setError('Write a short pitch first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await applyToJob(id, {
        pitch: trimmedPitch,
        ...(link.trim() ? { link: link.trim() } : {}),
      });
      setApplyOpen(false);
      setPitch('');
      setLink('');
      await load();
      Alert.alert('Sent', 'Your application is with the poster.');
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  // withdraw / close / delete all follow the same shape: confirm, call,
  // refresh (or leave). Sharing one runner keeps the handlers short.
  async function run(action: () => Promise<unknown>, after: 'reload' | 'back') {
    setBusy(true);
    setError('');
    try {
      await action();
      if (after === 'back') navigation.goBack();
      else await load();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmClose() {
    Alert.alert('Close this post?', 'It stops accepting applications but stays visible for a week.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close post', onPress: () => run(() => closeJobPost(id), 'reload') },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete this post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => run(() => deleteJobPost(id), 'back'),
      },
    ]);
  }

  if (loading) return <Loading />;

  if (!post) {
    return (
      <View className="flex-1 bg-brand-cream">
        {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        <Empty message="This post is no longer on the board." />
      </View>
    );
  }

  const closed = post.status === 'closed';
  const tags = toTypeList(post.tags);

  return (
    <View className="flex-1 bg-brand-cream">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-3 flex-row flex-wrap gap-2">
          <Chip label={post.type === 'job' ? 'Offering work' : 'Looking for help'} />
          {closed ? <Chip label="Closed" tone="warn" /> : null}
          {post.viewer_applied ? <Chip label="You applied" tone="solid" /> : null}
        </View>

        <Text className="text-[22px] font-bold leading-7 text-zinc-900">{post.title}</Text>
        {post.location ? (
          <Text className="mt-1.5 text-[14px] text-zinc-500">{post.location}</Text>
        ) : null}

        {/* Someone vouched for you on this post — worth showing prominently,
            it's the difference between a cold and a warm application. */}
        {post.incoming_referral ? (
          <View className="mt-4 rounded-2xl bg-amber-50 p-4">
            <Text className="text-[14px] font-semibold text-amber-900">
              {post.incoming_referral.referrer_name} referred you to this
            </Text>
            {post.incoming_referral.note ? (
              <Text className="mt-1 text-[13px] leading-5 text-amber-800">
                “{post.incoming_referral.note}”
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text className="mt-4 text-[15px] leading-6 text-zinc-800">{post.description}</Text>

        {tags.length > 0 ? (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {tags.map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        <View className="mt-6 flex-row items-center rounded-2xl border border-black/5 bg-white p-4">
          <Avatar uri={post.author.avatar_url} name={post.author.name} size={44} />
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-zinc-900">{post.author.name}</Text>
            {post.author.company_name ? (
              <Text className="text-[13px] text-zinc-500">{post.author.company_name}</Text>
            ) : null}
          </View>
        </View>

        <Text className="mt-3 text-[12px] text-zinc-400">
          Posted {formatDate(post.created_at)}
          {closed && post.closed_at ? ` · closed ${formatDate(post.closed_at)}` : ''}
        </Text>

        {error ? <ErrorNotice message={error} /> : null}

        {/* --- actions ------------------------------------------------- */}
        {post.is_own ? (
          <View className="mt-6">
            <PrimaryButton
              label={`View applicants${post.application_count ? ` (${post.application_count})` : ''}`}
              onPress={() => navigation.navigate('JobApplicants', { id, title: post.title })}
            />
            <SecondaryButton
              label="Edit post"
              disabled={busy}
              onPress={() => navigation.navigate('JobCompose', { post })}
            />
            {!closed ? (
              <SecondaryButton label="Close post" disabled={busy} onPress={confirmClose} />
            ) : null}
            <TouchableOpacity className="mt-3 items-center py-2" onPress={confirmDelete}>
              <Text className="text-[14px] font-semibold text-red-600">Delete post</Text>
            </TouchableOpacity>
          </View>
        ) : closed ? (
          <View className="mt-6 rounded-2xl bg-zinc-100 p-4">
            <Text className="text-center text-[14px] text-zinc-600">
              This post is closed and no longer accepting applications.
            </Text>
          </View>
        ) : post.viewer_applied ? (
          <View className="mt-6">
            <View className="rounded-2xl bg-brand-blue/10 p-4">
              <Text className="text-center text-[14px] text-brand-blue">
                You've applied. The poster can see your pitch.
              </Text>
            </View>
            <SecondaryButton
              label="Withdraw application"
              disabled={busy}
              onPress={() => run(() => withdrawApplication(id), 'reload')}
            />
          </View>
        ) : (
          <View className="mt-6">
            <PrimaryButton label="Apply" onPress={() => setApplyOpen(true)} />
            <SecondaryButton
              label="Refer someone"
              disabled={busy}
              onPress={() => navigation.navigate('JobRefer', { id, authorId: post.author.id })}
            />
          </View>
        )}
      </ScrollView>

      {/* --- apply sheet ------------------------------------------------ */}
      <Modal visible={applyOpen} animationType="slide" transparent onRequestClose={() => setApplyOpen(false)}>
        <KeyboardAvoidingView
          className="flex-1 justify-end bg-black/40"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="rounded-t-3xl bg-brand-cream p-5 pb-8">
            <Text className="text-[18px] font-bold text-zinc-900">Apply</Text>
            <Text className="mt-1 text-[13px] text-zinc-500">
              A few sentences on why you're a fit.
            </Text>

            <TextInput
              className="mt-4 h-32 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-zinc-900"
              placeholder="Why you're a fit"
              placeholderTextColor="#a1a1aa"
              multiline
              textAlignVertical="top"
              maxLength={MAX_PITCH}
              value={pitch}
              onChangeText={setPitch}
              editable={!busy}
            />
            <Text className="mt-1 text-right text-[11px] text-zinc-400">
              {pitch.length}/{MAX_PITCH}
            </Text>

            <TextInput
              className="mt-2 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-zinc-900"
              placeholder="Link (optional) — portfolio, CV, site"
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              keyboardType="url"
              maxLength={MAX_LINK}
              value={link}
              onChangeText={setLink}
              editable={!busy}
            />

            <PrimaryButton label="Send application" disabled={busy} busy={busy} onPress={submitApplication} />
            <TouchableOpacity
              className="mt-3 items-center py-2"
              onPress={() => setApplyOpen(false)}
              disabled={busy}
            >
              <Text className="text-[14px] font-semibold text-zinc-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

