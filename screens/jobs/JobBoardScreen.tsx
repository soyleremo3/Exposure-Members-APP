// Job board: posts where members offer work ("job") or ask for help ("need").
//
// The list endpoint returns open posts plus anything closed in the last 7
// days, already ordered — so this screen only filters by type and renders.
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getJobPosts } from '../../lib/api';
import { timeAgo, toTypeList } from '../../lib/format';
import { BRAND_BLUE, BRAND_CREAM } from '../../lib/theme';
import type { JobPost, JobType } from '../../types';
import type { RootStackParamList } from '../../navigation';
import Avatar from '../../components/Avatar';
import Chip from '../../components/Chip';
import { Empty, ErrorNotice, Loading } from '../../components/Feedback';

type Filter = 'all' | JobType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'job', label: 'Offering work' },
  { key: 'need', label: 'Looking for help' },
];

export default function JobBoardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const data = await getJobPosts();
      setPosts(data.posts ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the job board.');
    }
  }, []);

  // Reload on focus, not just on mount: creating a post, applying to one or
  // closing one all happen on other screens and change what belongs here.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => p.type === filter)),
    [posts, filter],
  );

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-brand-cream">
      <View className="flex-row gap-2 px-3 pb-1 pt-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              className={`rounded-full px-3.5 py-2 ${active ? 'bg-brand-blue' : 'bg-brand-blue/10'}`}
              activeOpacity={0.8}
              onPress={() => setFilter(f.key)}
            >
              <Text
                className={`text-[13px] font-semibold ${
                  active ? 'text-brand-cream' : 'text-brand-blue'
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          error ? null : <Empty message="Nothing posted here yet. Be the first." />
        }
        renderItem={({ item }) => (
          <PostCard post={item} onPress={() => navigation.navigate('JobDetail', { id: item.id })} />
        )}
      />

      <TouchableOpacity
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-brand-blue shadow-lg"
        activeOpacity={0.85}
        onPress={() => navigation.navigate('JobCompose')}
      >
        <Ionicons name="add" size={30} color={BRAND_CREAM} />
      </TouchableOpacity>
    </View>
  );
}

function PostCard({ post, onPress }: { post: JobPost; onPress: () => void }) {
  const closed = post.status === 'closed';
  const tags = toTypeList(post.tags);

  return (
    <TouchableOpacity
      className={`mb-2.5 rounded-2xl border border-black/5 bg-white p-4 ${closed ? 'opacity-60' : ''}`}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View className="mb-2 flex-row flex-wrap gap-2">
        <Chip label={post.type === 'job' ? 'Offering work' : 'Looking for help'} />
        {closed ? <Chip label="Closed" tone="warn" /> : null}
        {post.is_own ? <Chip label="Yours" tone="solid" /> : null}
        {post.viewer_applied ? <Chip label="Applied" tone="solid" /> : null}
        {post.incoming_referral ? <Chip label="Referred to you" tone="warn" /> : null}
      </View>

      <Text className="text-[16px] font-semibold leading-5 text-zinc-900">{post.title}</Text>
      {post.location ? (
        <Text className="mt-1 text-[13px] text-zinc-500">{post.location}</Text>
      ) : null}
      <Text className="mt-1.5 text-[14px] leading-5 text-zinc-600" numberOfLines={3}>
        {post.description}
      </Text>

      {tags.length > 0 ? (
        <View className="mt-2.5 flex-row flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center border-t border-black/5 pt-3">
        <Avatar uri={post.author.avatar_url} name={post.author.name} size={28} />
        <Text className="ml-2 flex-1 text-[13px] text-zinc-600" numberOfLines={1}>
          {post.author.name}
          {post.author.company_name ? ` · ${post.author.company_name}` : ''}
        </Text>
        {/* application_count is only meaningful on your own posts — the API
            sends 0 for everyone else's. */}
        {post.is_own && post.application_count > 0 ? (
          <Text className="mr-2 text-[13px] font-semibold text-brand-blue">
            {post.application_count} applied
          </Text>
        ) : null}
        <Text className="text-[12px] text-zinc-400">{timeAgo(post.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}
