// Job Board — one screen, everything inline, mirroring the website.
//
// The website's job board is deliberately simpler than the API allows: it
// shows ONLY posts of type "job" (never "need"), and its compose form always
// sends `type: 'job'` with empty tags — there's no type picker and no tag UI.
// We reproduce that exactly (see the repo's job-board/PostForm.tsx). "need"
// posts still exist in the data; they're just not surfaced here.
//
// Rows expand in place (no detail screen) to reveal the description, the
// poster, and the actions: apply / refer for other people's posts, and
// edit / close / delete / applicants for your own. Compose is an inline card
// toggled by "Add post". Every write is blocked for read-only test accounts
// (see API.md → read-only), so those 403s are swallowed and a banner explains.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  applyToJob,
  closeJobPost,
  createJobPost,
  deleteJobPost,
  getDirectory,
  getJobApplications,
  getJobNotifications,
  getJobPosts,
  getProfile,
  isReadOnlyError,
  readableError,
  READ_ONLY_NOTICE,
  referMember,
  updateJobNotifications,
  updateJobPost,
  withdrawApplication,
} from '../../lib/api';
import { toTypeList } from '../../lib/format';
import { API_BASE } from '../../lib/config';
import { BRAND_BLUE } from '../../lib/theme';
import type {
  JobApplication,
  JobNotificationSettings,
  JobPost,
  Member,
} from '../../types';
import Avatar from '../../components/Avatar';
import { Empty, ErrorNotice, InfoNotice, Loading } from '../../components/Feedback';

// Only jobs have a location; blank means Online — same rule as the website.
function displayLocation(post: JobPost): string {
  return post.location || 'Online';
}

export default function JobBoardScreen() {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<JobPost | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getJobPosts();
      setPosts(data.posts ?? []);
      setError('');
    } catch (e) {
      setError(readableError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  // The viewer's id (to exclude self from referral search) and whether they're
  // a read-only tester. Best-effort — a failure here just leaves the defaults.
  useEffect(() => {
    getProfile()
      .then((p) => {
        setMeId(p.member.id);
        setReadOnly(p.member.member_category === 'test');
      })
      .catch(() => {});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Distinct job locations for the filter row.
  const locations = useMemo(
    () =>
      Array.from(
        new Set(posts.filter((p) => p.type === 'job').map(displayLocation)),
      ).sort((a, b) => a.localeCompare(b)),
    [posts],
  );

  const jobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts
      .filter((p) => p.type === 'job')
      .filter((p) => !location || displayLocation(p) === location)
      .filter((p) => {
        if (!q) return true;
        return [
          p.title,
          p.description,
          displayLocation(p),
          p.author.name,
          p.author.company_name || '',
          ...toTypeList(p.tags),
        ].some((v) => String(v).toLowerCase().includes(q));
      });
  }, [posts, search, location]);

  function openNew() {
    setEditingPost(null);
    setFormOpen(true);
  }

  function openEdit(post: JobPost) {
    setEditingPost(post);
    setFormOpen(true);
  }

  function afterSave() {
    setFormOpen(false);
    setEditingPost(null);
    load();
  }

  if (loading) return <Loading />;

  return (
    <SafeAreaView className="flex-1 bg-brand-cream" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
          }
          ListHeaderComponent={
            <View>
              <Text className="text-xl font-bold text-zinc-900">Job Board</Text>
              <Text className="mt-1 text-sm text-zinc-500">
                Jobs and needs from Exposure founders.
              </Text>

              {readOnly ? (
                <View className="mt-4">
                  <InfoNotice message={READ_ONLY_NOTICE} />
                </View>
              ) : null}

              <View className="mt-4 flex-row justify-end">
                <TouchableOpacity
                  className="flex-row items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5"
                  activeOpacity={0.85}
                  onPress={openNew}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Add post</Text>
                </TouchableOpacity>
              </View>

              <NotifyCard readOnly={readOnly} />

              {formOpen ? (
                <PostForm
                  post={editingPost}
                  onCancel={() => {
                    setFormOpen(false);
                    setEditingPost(null);
                  }}
                  onSaved={afterSave}
                />
              ) : null}

              <View className="mt-2 flex-row items-center rounded-xl border border-black/10 bg-white px-3.5">
                <Ionicons name="search" size={16} color="#a1a1aa" />
                <TextInput
                  className="flex-1 py-3 pl-2.5 text-[15px] text-zinc-900"
                  placeholder="Search titles, descriptions, people, companies…"
                  placeholderTextColor="#a1a1aa"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
              </View>

              {locations.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-3"
                  contentContainerStyle={{ gap: 8 }}
                >
                  <LocationChip label="All locations" active={!location} onPress={() => setLocation('')} />
                  {locations.map((loc) => (
                    <LocationChip
                      key={loc}
                      label={loc}
                      active={location === loc}
                      onPress={() => setLocation(loc)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              {error ? <View className="mt-4"><ErrorNotice message={error} onRetry={load} /></View> : null}

              {jobs.length > 0 ? (
                <View className="mb-3 mt-6 flex-row items-center gap-3">
                  <Text className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Jobs
                  </Text>
                  <Text className="text-[10px] text-zinc-400">{jobs.length}</Text>
                  <View className="h-px flex-1 bg-black/10" />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            error ? null : (
              <Empty
                message={
                  search || location ? 'No posts match your search.' : 'No posts yet.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <PostRow
              post={item}
              me={meId}
              readOnly={readOnly}
              expanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === item.id ? null : item.id))
              }
              onEdit={() => openEdit(item)}
              onChanged={load}
            />
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LocationChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-row items-center gap-1 self-start rounded-full px-3.5 py-2 ${
        active ? 'bg-brand-blue' : 'bg-brand-blue/10'
      }`}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Ionicons name="location-outline" size={12} color={active ? '#fff' : BRAND_BLUE} />
      <Text
        className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-brand-blue'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// -------------------------------------------------------------- notifications

function NotifyCard({ readOnly }: { readOnly: boolean }) {
  const [sub, setSub] = useState<JobNotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJobNotifications()
      .then((d) => setSub(d.subscription))
      .catch(() => {});
  }, []);

  async function toggle(key: keyof JobNotificationSettings) {
    if (!sub) return;
    const previous = sub;
    const next = { ...sub, [key]: !sub[key] };
    setSub(next);
    setSaving(true);
    try {
      const d = await updateJobNotifications({ [key]: next[key] });
      setSub(d.subscription);
    } catch (e) {
      setSub(previous); // revert; read-only or a real failure both roll back
      if (!isReadOnlyError(e)) {
        // A genuine failure — leave the toggle reverted. (No inline error slot
        // here; the reverted switch is the signal.)
      }
    } finally {
      setSaving(false);
    }
  }

  if (!sub) return null;

  return (
    <View className="mt-4 rounded-2xl border border-black/5 bg-white p-5">
      <NotifyToggle
        label="Email me about new jobs"
        description={
          sub.notify_jobs
            ? "You'll get an email when a member posts a new job."
            : 'Skip checking back — get notified when a new job is posted.'
        }
        enabled={sub.notify_jobs}
        disabled={saving || readOnly}
        onToggle={() => toggle('notify_jobs')}
      />
      <View className="my-4 h-px bg-black/5" />
      <NotifyToggle
        label="Email me about new needs"
        description={
          sub.notify_needs
            ? "You'll get an email when a member posts a new need."
            : 'Get notified when a member posts something they need.'
        }
        enabled={sub.notify_needs}
        disabled={saving || readOnly}
        onToggle={() => toggle('notify_needs')}
      />
    </View>
  );
}

function NotifyToggle({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="text-sm font-medium text-zinc-900">{label}</Text>
        <Text className="mt-0.5 text-xs text-zinc-500">{description}</Text>
      </View>
      <TouchableOpacity
        className={`mt-0.5 h-6 w-11 justify-center rounded-full px-0.5 ${
          enabled ? 'bg-brand-blue' : 'bg-zinc-300'
        } ${disabled ? 'opacity-50' : ''}`}
        activeOpacity={0.8}
        disabled={disabled}
        onPress={onToggle}
      >
        <View className={`h-5 w-5 rounded-full bg-white ${enabled ? 'self-end' : 'self-start'}`} />
      </TouchableOpacity>
    </View>
  );
}

// -------------------------------------------------------------------- compose

function PostForm({
  post,
  onCancel,
  onSaved,
}: {
  post: JobPost | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [description, setDescription] = useState(post?.description ?? '');
  const [location, setLocation] = useState(post?.location ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    setError('');
    // Always type "job" with no tags — the website's compose does the same.
    const draft = { type: 'job' as const, title, description, location, tags: [] };
    try {
      if (post) await updateJobPost(post.id, draft);
      else await createJobPost(draft);
      onSaved();
    } catch (e) {
      if (isReadOnlyError(e)) {
        setError(READ_ONLY_NOTICE);
        return;
      }
      setError(readableError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-white">
      <View className="flex-row items-start justify-between border-b border-black/5 px-5 py-4">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-semibold text-zinc-900">
            {post ? 'Edit post' : 'Add to the Job Board'}
          </Text>
          <Text className="mt-0.5 text-xs text-zinc-500">
            Members apply with a short note and profile — you review applicants and reach out.
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.7} className="p-1">
          <Ionicons name="close" size={18} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      <View className="gap-4 p-5">
        <Field label="Title">
          <TextInput
            className="rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-900"
            value={title}
            onChangeText={setTitle}
            maxLength={140}
            placeholderTextColor="#a1a1aa"
          />
        </Field>
        <Field label="Description">
          <TextInput
            className="h-32 rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-[15px] leading-6 text-zinc-900"
            value={description}
            onChangeText={setDescription}
            maxLength={5000}
            multiline
            textAlignVertical="top"
            placeholderTextColor="#a1a1aa"
          />
        </Field>
        <Field label="Location" hint="optional, blank means Online">
          <TextInput
            className="rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-900"
            value={location}
            onChangeText={setLocation}
            maxLength={120}
            placeholderTextColor="#a1a1aa"
          />
        </Field>

        {error ? <Text className="text-xs text-red-600">{error}</Text> : null}

        <View className="flex-row justify-end gap-2 border-t border-black/5 pt-4">
          <TouchableOpacity className="px-4 py-2.5" activeOpacity={0.7} onPress={onCancel}>
            <Text className="text-xs font-semibold text-zinc-500">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`rounded-xl bg-brand-blue px-5 py-2.5 ${saving ? 'opacity-50' : ''}`}
            activeOpacity={0.85}
            disabled={saving}
            onPress={submit}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-xs font-semibold text-white">{post ? 'Save changes' : 'Publish'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
        {hint ? <Text className="font-normal normal-case tracking-normal text-zinc-400"> {hint}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

// ------------------------------------------------------------------- post row

function PostRow({
  post,
  me,
  readOnly,
  expanded,
  onToggle,
  onEdit,
  onChanged,
}: {
  post: JobPost;
  me: string | null;
  readOnly: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const company = post.author.company_name || 'Independent';

  return (
    <View className={`mb-2 overflow-hidden rounded-2xl border border-black/5 bg-white ${expanded ? 'bg-white' : ''}`}>
      <TouchableOpacity
        className="flex-row items-start gap-3 p-4"
        activeOpacity={0.7}
        onPress={onToggle}
      >
        <Avatar uri={post.author.avatar_url} name={post.author.name} size={44} />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[15px] font-semibold text-brand-blue">{post.title}</Text>
            {post.status === 'closed' ? <Tag label="Closed" tone="muted" /> : null}
            {post.is_own ? <Tag label="Yours" tone="blue" /> : null}
          </View>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
            <Text className="text-xs text-zinc-600">{company}</Text>
            <Text className="text-xs text-zinc-400">•</Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={11} color="#a1a1aa" />
              <Text className="text-xs text-zinc-500">{displayLocation(post)}</Text>
            </View>
          </View>
        </View>
        <Ionicons
          name="chevron-down"
          size={16}
          color="#a1a1aa"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded ? (
        <PostDetails post={post} me={me} readOnly={readOnly} onEdit={onEdit} onChanged={onChanged} />
      ) : null}
    </View>
  );
}

function Tag({ label, tone }: { label: string; tone: 'muted' | 'blue' }) {
  const style =
    tone === 'blue'
      ? { box: 'bg-brand-blue/15', text: 'text-brand-blue' }
      : { box: 'bg-zinc-100', text: 'text-zinc-500' };
  return (
    <View className={`rounded px-1.5 py-0.5 ${style.box}`}>
      <Text className={`text-[9px] font-bold uppercase tracking-wider ${style.text}`}>{label}</Text>
    </View>
  );
}

// --------------------------------------------------------------- post details

// Render a description with tappable links, like the website's Description.
function DescriptionText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <Text className="text-sm leading-7 text-zinc-700">
      {parts.map((part, i) =>
        part.startsWith('http') ? (
          <Text
            key={i}
            className="text-brand-blue"
            onPress={() => Linking.openURL(part).catch(() => {})}
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function PostDetails({
  post,
  me,
  readOnly,
  onEdit,
  onChanged,
}: {
  post: JobPost;
  me: string | null;
  readOnly: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const tags = toTypeList(post.tags);

  const loadApps = useCallback(() => {
    if (!post.is_own) return;
    setLoadingApps(true);
    getJobApplications(post.id)
      .then((d) => setApplications(d.applications ?? []))
      .catch(() => {})
      .finally(() => setLoadingApps(false));
  }, [post.id, post.is_own]);

  useEffect(() => {
    loadApps();
  }, [loadApps, post.application_count]);

  function confirm(message: string, onYes: () => void) {
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: onYes },
    ]);
  }

  async function run(fn: () => Promise<unknown>, failMsg: string) {
    setWorking(true);
    setError('');
    try {
      await fn();
      onChanged();
    } catch (e) {
      if (!isReadOnlyError(e)) setError(readableError(e, failMsg));
    } finally {
      setWorking(false);
    }
  }

  return (
    <View className="border-t border-black/5 bg-zinc-50 px-5 py-5">
      <DescriptionText text={post.description} />

      <Text className="mt-4 text-[11px] text-zinc-500">
        Posted by <Text className="font-medium text-zinc-700">{post.author.name}</Text>
        {post.author.company_name ? ` at ${post.author.company_name}` : ''}
      </Text>

      {tags.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-1.5">
          {tags.map((tag) => (
            <View key={tag} className="rounded-full bg-zinc-100 px-2.5 py-1">
              <Text className="text-[10px] font-medium text-zinc-600">{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {post.incoming_referral && !post.viewer_applied ? (
        <View className="mt-5 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="sparkles" size={14} color={BRAND_BLUE} />
            <Text className="text-xs font-semibold text-brand-blue">
              {post.incoming_referral.referrer_name} referred you for this role
            </Text>
          </View>
          {post.incoming_referral.note ? (
            <Text className="mt-1.5 text-xs leading-5 text-zinc-600">
              “{post.incoming_referral.note}”
            </Text>
          ) : null}
        </View>
      ) : null}

      {readOnly ? <View className="mt-5"><InfoNotice message={READ_ONLY_NOTICE} /></View> : null}

      {/* Someone else's post: apply / refer */}
      {!post.is_own ? (
        <View className="mt-5 border-t border-black/5 pt-5">
          {post.viewer_applied ? (
            <View className="flex-row flex-wrap items-center gap-3">
              <View className="flex-row items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text className="text-xs font-semibold text-emerald-700">
                  Applied — the poster will reach out
                </Text>
              </View>
              <TouchableOpacity
                disabled={working}
                onPress={() => confirm('Withdraw your application?', () =>
                  run(() => withdrawApplication(post.id), 'Could not withdraw'),
                )}
              >
                <Text className="text-[11px] font-semibold text-zinc-500">Withdraw</Text>
              </TouchableOpacity>
            </View>
          ) : post.status === 'open' ? (
            <View className="flex-row flex-wrap items-center gap-2">
              <TouchableOpacity
                className="rounded-xl bg-brand-blue px-4 py-2.5"
                activeOpacity={0.85}
                onPress={() => {
                  setShowApply((v) => !v);
                  setShowRefer(false);
                }}
              >
                <Text className="text-xs font-semibold text-white">Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5"
                activeOpacity={0.8}
                onPress={() => {
                  setShowRefer((v) => !v);
                  setShowApply(false);
                }}
              >
                <Ionicons name="person-add-outline" size={14} color="#52525b" />
                <Text className="text-xs font-semibold text-zinc-700">Refer a friend</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="lock-closed-outline" size={14} color="#a1a1aa" />
              <Text className="text-xs text-zinc-500">This post is closed.</Text>
            </View>
          )}

          {showApply && post.status === 'open' && !post.viewer_applied ? (
            <ApplyPanel
              postId={post.id}
              onCancel={() => setShowApply(false)}
              onApplied={() => {
                setShowApply(false);
                onChanged();
              }}
            />
          ) : null}

          {showRefer && post.status === 'open' ? (
            <ReferPanel
              post={post}
              me={me}
              onCancel={() => setShowRefer(false)}
              onReferred={onChanged}
            />
          ) : null}
        </View>
      ) : null}

      {/* Your own post: edit / close / refer / delete + applicants */}
      {post.is_own ? (
        <View className="mt-5 border-t border-black/5 pt-5">
          <View className="mb-4 flex-row flex-wrap gap-2">
            <OwnerButton icon="pencil" label="Edit" disabled={working} onPress={onEdit} />
            {post.status === 'open' ? (
              <>
                <OwnerButton
                  icon="checkmark-circle-outline"
                  label="Close"
                  disabled={working}
                  onPress={() =>
                    confirm(
                      'Close this post? It will stop accepting applications and disappear after seven days.',
                      () => run(() => closeJobPost(post.id), 'Could not close post'),
                    )
                  }
                />
                <OwnerButton
                  icon="person-add-outline"
                  label="Refer"
                  disabled={working}
                  onPress={() => setShowRefer((v) => !v)}
                />
              </>
            ) : null}
            <OwnerButton
              icon="trash-outline"
              label="Delete"
              tone="danger"
              disabled={working}
              onPress={() =>
                confirm('Permanently delete this post?', () =>
                  run(() => deleteJobPost(post.id), 'Could not delete post'),
                )
              }
            />
          </View>

          {showRefer && post.status === 'open' ? (
            <ReferPanel
              post={post}
              me={me}
              onCancel={() => setShowRefer(false)}
              onReferred={onChanged}
            />
          ) : null}

          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="people-outline" size={14} color="#a1a1aa" />
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Applicants ({post.application_count})
            </Text>
          </View>
          {loadingApps ? (
            <ActivityIndicator className="mt-3" color={BRAND_BLUE} />
          ) : applications.length === 0 ? (
            <Text className="mt-3 text-xs text-zinc-500">No applications yet.</Text>
          ) : (
            <View className="mt-3 gap-3">
              {applications.map((application) => (
                <ApplicantCard key={application.id} application={application} />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {error ? <Text className="mt-3 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

function OwnerButton({
  icon,
  label,
  tone,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'danger';
  disabled?: boolean;
  onPress: () => void;
}) {
  const danger = tone === 'danger';
  return (
    <TouchableOpacity
      className={`flex-row items-center gap-1.5 rounded-xl px-3 py-2 ${
        danger ? 'bg-red-500/10' : 'bg-zinc-100'
      } ${disabled ? 'opacity-50' : ''}`}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons name={icon} size={14} color={danger ? '#dc2626' : '#52525b'} />
      <Text className={`text-xs font-semibold ${danger ? 'text-red-600' : 'text-zinc-700'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ------------------------------------------------------------------- applying

function ApplyPanel({
  postId,
  onCancel,
  onApplied,
}: {
  postId: string;
  onCancel: () => void;
  onApplied: () => void;
}) {
  const [pitch, setPitch] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await applyToJob(postId, { pitch, link });
      onApplied();
    } catch (e) {
      if (isReadOnlyError(e)) {
        setError(READ_ONLY_NOTICE);
        return;
      }
      setError(readableError(e, 'Could not submit your application'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="mt-4 gap-4 rounded-xl border border-black/10 bg-white p-4">
      <View>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Why you&apos;re a fit
          </Text>
          <Text className="text-[10px] text-zinc-400">{pitch.length}/1500</Text>
        </View>
        <TextInput
          className="h-24 rounded-xl border border-black/10 bg-zinc-50 px-3.5 py-2.5 text-sm leading-6 text-zinc-900"
          value={pitch}
          onChangeText={setPitch}
          maxLength={1500}
          multiline
          textAlignVertical="top"
          placeholder="A sentence or two on why you're a good match — the poster reads this first."
          placeholderTextColor="#a1a1aa"
        />
      </View>

      <View>
        <Text className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Link <Text className="font-normal normal-case tracking-normal text-zinc-400">optional — portfolio, CV, LinkedIn</Text>
        </Text>
        <TextInput
          className="rounded-xl border border-black/10 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900"
          value={link}
          onChangeText={setLink}
          maxLength={500}
          autoCapitalize="none"
          placeholder="https://"
          placeholderTextColor="#a1a1aa"
        />
      </View>

      <Text className="text-[11px] leading-5 text-zinc-500">
        Your profile and contact details are shared with the poster so they can reach out.
      </Text>

      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}

      <View className="flex-row justify-end gap-2">
        <TouchableOpacity className="px-4 py-2.5" activeOpacity={0.7} onPress={onCancel}>
          <Text className="text-xs font-semibold text-zinc-500">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`rounded-xl bg-brand-blue px-5 py-2.5 ${saving ? 'opacity-50' : ''}`}
          activeOpacity={0.85}
          disabled={saving}
          onPress={submit}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-xs font-semibold text-white">Submit application</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------- referring

function ReferPanel({
  post,
  me,
  onCancel,
  onReferred,
}: {
  post: JobPost;
  me: string | null;
  onCancel: () => void;
  onReferred: () => void;
}) {
  const [tab, setTab] = useState<'member' | 'friend'>('member');
  const [directory, setDirectory] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDirectory()
      .then((d) => setDirectory(d.members ?? []))
      .catch(() => {});
  }, []);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory
      .filter((m) => m.id !== post.author.id && m.id !== me && m.name)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [directory, search, post.author.id, me]);

  const friendLink = post.share_token
    ? `${API_BASE}/jobs/${post.share_token}${me ? `?ref=${me}` : ''}`
    : '';

  async function submit() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await referMember(post.id, { referred_member_id: selected.id, note });
      setDone(true);
      onReferred();
    } catch (e) {
      if (isReadOnlyError(e)) {
        setError(READ_ONLY_NOTICE);
        return;
      }
      setError(readableError(e, 'Could not send the referral'));
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!friendLink) return;
    await Clipboard.setStringAsync(friendLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View className="mt-4 rounded-xl border border-black/10 bg-white p-4">
      <View className="mb-4 flex-row gap-1 rounded-xl bg-zinc-100 p-1">
        {(['member', 'friend'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            className={`flex-1 items-center rounded-lg px-3 py-1.5 ${
              tab === value ? 'bg-brand-blue' : ''
            }`}
            activeOpacity={0.8}
            onPress={() => {
              setTab(value);
              setError('');
            }}
          >
            <Text
              className={`text-xs font-semibold ${tab === value ? 'text-white' : 'text-zinc-500'}`}
            >
              {value === 'member' ? 'A member' : 'An outside friend'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'member' ? (
        done ? (
          <View className="flex-row items-center gap-2 py-4">
            <Ionicons name="checkmark" size={16} color="#059669" />
            <Text className="text-xs text-emerald-700">
              Referral sent to {selected?.name}. We&apos;ve let them know.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {selected ? (
              <View className="flex-row items-center justify-between rounded-xl border border-black/10 bg-zinc-50 px-3 py-2.5">
                <View className="flex-row items-center gap-2.5">
                  <Avatar uri={selected.avatar_url} name={selected.name} size={32} />
                  <Text className="text-sm font-medium text-zinc-900">{selected.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)}>
                  <Text className="text-[11px] font-semibold text-zinc-500">Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View className="flex-row items-center rounded-xl border border-black/10 bg-zinc-50 px-3">
                  <Ionicons name="search" size={16} color="#a1a1aa" />
                  <TextInput
                    className="flex-1 py-2.5 pl-2 text-sm text-zinc-900"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search members by name..."
                    placeholderTextColor="#a1a1aa"
                    autoCapitalize="none"
                  />
                </View>
                {candidates.length > 0 ? (
                  <View className="mt-2 overflow-hidden rounded-xl border border-black/10">
                    {candidates.map((m, i) => (
                      <TouchableOpacity
                        key={m.id}
                        className={`flex-row items-center gap-2.5 px-3 py-2.5 ${
                          i > 0 ? 'border-t border-black/5' : ''
                        }`}
                        activeOpacity={0.7}
                        onPress={() => setSelected(m)}
                      >
                        <Avatar uri={m.avatar_url} name={m.name} size={32} />
                        <Text className="text-sm text-zinc-800">{m.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            {selected ? (
              <View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Note <Text className="font-normal normal-case tracking-normal text-zinc-400">optional</Text>
                  </Text>
                  <Text className="text-[10px] text-zinc-400">{note.length}/500</Text>
                </View>
                <TextInput
                  className="h-20 rounded-xl border border-black/10 bg-zinc-50 px-3.5 py-2.5 text-sm leading-6 text-zinc-900"
                  value={note}
                  onChangeText={setNote}
                  maxLength={500}
                  multiline
                  textAlignVertical="top"
                  placeholder="Why they'd be great for this — they'll see this in the referral."
                  placeholderTextColor="#a1a1aa"
                />
              </View>
            ) : null}

            {error ? <Text className="text-xs text-red-600">{error}</Text> : null}

            <View className="flex-row justify-end gap-2">
              <TouchableOpacity className="px-4 py-2.5" activeOpacity={0.7} onPress={onCancel}>
                <Text className="text-xs font-semibold text-zinc-500">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`rounded-xl bg-brand-blue px-5 py-2.5 ${
                  !selected || saving ? 'opacity-50' : ''
                }`}
                activeOpacity={0.85}
                disabled={!selected || saving}
                onPress={submit}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-xs font-semibold text-white">Send referral</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : (
        <View className="gap-3">
          <Text className="text-xs leading-5 text-zinc-500">
            Share this link with someone outside the community. They can apply directly, and it&apos;ll
            show the poster that you referred them.
          </Text>
          {friendLink ? (
            <View className="flex-row items-center gap-2">
              <Text
                className="flex-1 rounded-xl border border-black/10 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600"
                numberOfLines={1}
              >
                {friendLink}
              </Text>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2.5"
                activeOpacity={0.85}
                onPress={copyLink}
              >
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#fff" />
                <Text className="text-xs font-semibold text-white">{copied ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text className="text-xs text-zinc-500">No share link is available for this post.</Text>
          )}
          <View className="flex-row justify-end">
            <TouchableOpacity className="px-4 py-2" activeOpacity={0.7} onPress={onCancel}>
              <Text className="text-xs font-semibold text-zinc-500">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function ApplicantCard({ application }: { application: JobApplication }) {
  const { applicant } = application;
  return (
    <View className="rounded-xl border border-black/5 bg-white p-4">
      <View className="flex-row items-start gap-3">
        <Avatar uri={applicant.avatar_url} name={applicant.name} size={36} />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-semibold text-zinc-900">{applicant.name}</Text>
            {applicant.company_name ? (
              <Text className="text-[11px] text-zinc-500">{applicant.company_name}</Text>
            ) : null}
            {applicant.is_external ? <Tag label="External" tone="muted" /> : null}
          </View>
          {application.referred_by_name ? (
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons name="sparkles" size={11} color={BRAND_BLUE} />
              <Text className="text-[11px] text-brand-blue">
                Referred by {application.referred_by_name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text className="mt-3 text-xs leading-6 text-zinc-700">{application.pitch}</Text>

      <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
        {applicant.email ? (
          <ContactChip
            icon="mail-outline"
            label={applicant.email}
            onPress={() => Linking.openURL(`mailto:${applicant.email}`).catch(() => {})}
          />
        ) : null}
        {applicant.phone ? <ContactChip icon="call-outline" label={applicant.phone} /> : null}
        {applicant.linkedin ? (
          <ContactChip
            icon="logo-linkedin"
            label="LinkedIn"
            tint
            onPress={() => Linking.openURL(applicant.linkedin as string).catch(() => {})}
          />
        ) : null}
        {application.link ? (
          <ContactChip
            icon="open-outline"
            label="Attached link"
            tint
            onPress={() => Linking.openURL(application.link as string).catch(() => {})}
          />
        ) : null}
      </View>
    </View>
  );
}

function ContactChip({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: boolean;
  onPress?: () => void;
}) {
  const color = tint ? BRAND_BLUE : '#a1a1aa';
  const textClass = tint ? 'text-brand-blue' : 'text-zinc-500';
  const content = (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={13} color={color} />
      <Text className={`text-[11px] ${textClass}`}>{label}</Text>
    </View>
  );
  return onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {content}
    </TouchableOpacity>
  ) : (
    content
  );
}
