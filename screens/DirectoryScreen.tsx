// The member directory: search, then tap someone to see their full profile.
//
// Everything is filtered client-side. The community is a few hundred people,
// not a social network, so one fetch and an in-memory filter is instant and
// saves building a search API.
//
// The card mirrors the website's directory card (three columns there, one
// here). Watch out for three fields whose names lie — `bio` is the member's
// current occupation, `instagram` is their education, `twitter` is their area
// of interest. See the table at the top of API.md's Profile section.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDirectory } from '../lib/api';
import { toTypeList } from '../lib/format';
import { BRAND_BLUE } from '../lib/theme';
import type { Member } from '../types';
import type { RootStackParamList } from '../navigation';
import Avatar from '../components/Avatar';
import { Empty, ErrorNotice, Loading } from '../components/Feedback';

export default function DirectoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getDirectory();
      setMembers(data.members ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load directory.');
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

  // Same fields the website searches — note it looks at `twitter` (area of
  // interest) but not `instagram` (education).
  const { current, past } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = members.filter((m) =>
      !q ||
      [m.name, m.bio, m.location, m.member_types, m.twitter].some(
        (field) => typeof field === 'string' && field.toLowerCase().includes(q),
      ),
    );
    return {
      current: matches.filter((m) => !m.is_past_member),
      past: matches.filter((m) => m.is_past_member),
    };
  }, [members, query]);

  if (loading) return <Loading />;

  const nothingFound = current.length === 0 && past.length === 0;

  return (
    // The navigator header is off for this tab (see App.tsx), so the top
    // inset has to be handled here.
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pb-3 pt-3">
        <Text className="text-xl font-bold text-body">Member Directory</Text>
        <Text className="mt-1 text-sm text-faint">Turkey&apos;s top 1%.</Text>

        <View className="mt-4 flex-row items-center rounded-2xl border border-hairline bg-surface px-3.5">
          <Ionicons name="search" size={16} color="#a1a1aa" />
          <TextInput
            className="flex-1 py-3 pl-2.5 text-[15px] text-body"
            placeholder="Search members by name, role, location…"
            placeholderTextColor="#a1a1aa"
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      <FlatList
        data={current}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListHeaderComponent={
          nothingFound ? null : (
            <Text className="mb-3 text-xs text-faint">
              {current.length} member{current.length === 1 ? '' : 's'}
            </Text>
          )
        }
        ListEmptyComponent={
          error || past.length > 0 ? null : (
            <Empty message={query ? 'No members match your search.' : 'No members yet.'} />
          )
        }
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            onPress={() => navigation.navigate('MemberDetail', { member: item })}
          />
        )}
        // Alumni are kept, but below the fold and dimmed — same as the website.
        ListFooterComponent={
          past.length === 0 ? null : (
            <View className="mt-6">
              <View className="mb-3 flex-row items-center gap-3">
                <Text className="text-xs font-bold uppercase tracking-wider text-faint">
                  Past Members
                </Text>
                <Text className="text-xs text-faint">{past.length}</Text>
                <View className="h-px flex-1 bg-black/10" />
              </View>
              <View className="opacity-60">
                {past.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onPress={() => navigation.navigate('MemberDetail', { member })}
                  />
                ))}
              </View>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function MemberCard({ member, onPress }: { member: Member; onPress: () => void }) {
  // Never read member_types directly — see toTypeList in lib/format.
  const types = toTypeList(member.member_types);

  return (
    <TouchableOpacity
      className="mb-3 rounded-2xl border border-hairline bg-surface p-4"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Avatar uri={member.avatar_url} name={member.name} size={56} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-shrink text-[15px] font-semibold text-body" numberOfLines={1}>
              {member.name}
            </Text>
            {member.batch ? <CohortBadge label={`E${member.batch}`} /> : null}
            {member.is_past_member ? <CohortBadge label="Past" tone="past" /> : null}
          </View>
          {member.location ? (
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons name="location-outline" size={12} color="#a1a1aa" />
              <Text className="flex-1 text-xs text-faint" numberOfLines={1}>
                {member.location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* `bio` is the member's current occupation, not a life story. */}
      {member.bio ? (
        <Text className="mt-3 text-xs leading-5 text-muted">{member.bio}</Text>
      ) : null}

      {types.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-1">
          {types.map((type) => (
            <View key={type} className="rounded-full bg-chip px-2 py-0.5">
              <Text className="text-[10px] font-medium text-muted">{type}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* `instagram` holds the educational background — see API.md. */}
      {member.instagram ? (
        <Text className="mt-2 text-xs text-faint">{member.instagram}</Text>
      ) : null}

      {/* Shown with a ✦ and deliberately NOT tappable, even when it's a URL —
          the website renders it as plain text too. */}
      {member.favorite_resource ? (
        <Text className="mt-2 text-[11px] italic leading-5 text-faint" numberOfLines={2}>
          ✦ {member.favorite_resource}
        </Text>
      ) : null}

      {member.linkedin || member.github ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          <SocialButton icon="logo-linkedin" label="LinkedIn" url={member.linkedin} />
          <SocialButton icon="logo-github" label="GitHub" url={member.github} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function CohortBadge({ label, tone = 'cohort' }: { label: string; tone?: 'cohort' | 'past' }) {
  const style =
    tone === 'past'
      ? { box: 'border border-amber-500/20 bg-amber-400/10', text: 'text-amber-600' }
      : { box: 'bg-chip', text: 'text-faint' };
  return (
    <View className={`rounded px-1.5 py-0.5 ${style.box}`}>
      <Text className={`text-[9px] font-bold uppercase tracking-wider ${style.text}`}>{label}</Text>
    </View>
  );
}

// Members fill these in inconsistently — plenty have no GitHub, and some type
// "linkedin.com/in/x" without a scheme, which openURL refuses to open.
function SocialButton({
  icon,
  label,
  url,
}: {
  icon: 'logo-linkedin' | 'logo-github';
  label: string;
  url?: string | null;
}) {
  if (!url) return null;
  const href = url.startsWith('http') ? url : `https://${url}`;
  return (
    <TouchableOpacity
      className="flex-row items-center gap-1.5 rounded-lg bg-chip px-2.5 py-1.5"
      activeOpacity={0.7}
      onPress={() => Linking.openURL(href).catch(() => {})}
    >
      <Ionicons name={icon} size={12} color="#52525b" />
      <Text className="text-[10px] font-semibold text-muted">{label}</Text>
    </TouchableOpacity>
  );
}
