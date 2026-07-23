// The member directory: search, then tap someone to see their full profile.
//
// Everything is filtered client-side. The community is a few hundred people,
// not a social network, so one fetch and an in-memory filter is instant and
// saves building a search API.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

  const visible = useMemo(() => {
    // The endpoint includes alumni (is_past_member). This is the current
    // member directory, so they're hidden here.
    const active = members.filter((m) => !m.is_past_member);
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((m) =>
      [m.name, m.location, m.bio, ...toTypeList(m.member_types)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [members, query]);

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-brand-cream">
      <View className="px-3 pb-2 pt-2">
        <TextInput
          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-[15px] text-zinc-900"
          placeholder="Search by name, city, or what they do"
          placeholderTextColor="#a1a1aa"
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          error ? null : (
            <Empty
              message={query ? 'No members match your search.' : 'The directory is empty.'}
            />
          )
        }
        renderItem={({ item }) => {
          // Never read member_types directly — see toTypeList in lib/format.
          const types = toTypeList(item.member_types);
          return (
            <TouchableOpacity
              className="mb-2.5 flex-row items-center rounded-2xl border border-black/5 bg-white p-3.5"
              activeOpacity={0.7}
              onPress={() => navigation.navigate('MemberDetail', { member: item })}
            >
              <Avatar uri={item.avatar_url} name={item.name} size={52} />
              <View className="ml-3.5 flex-1">
                <Text className="text-base font-semibold text-zinc-900" numberOfLines={1}>
                  {item.name}
                </Text>
                {item.location ? (
                  <Text className="mt-0.5 text-[13px] text-zinc-500" numberOfLines={1}>
                    {item.location}
                  </Text>
                ) : null}
                {types.length > 0 ? (
                  <Text className="mt-1 text-[12px] font-medium text-brand-blue" numberOfLines={1}>
                    {types.join(' · ')}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
