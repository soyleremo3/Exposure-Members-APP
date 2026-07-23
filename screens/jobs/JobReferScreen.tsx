// Point another member at a post: pick them from the directory, add a note.
//
// The server rejects referring yourself or the post's author (400), so those
// two are filtered out of the list rather than shown and then refused.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getDirectory, getProfile, readableError, referMember } from '../../lib/api';
import { toTypeList } from '../../lib/format';
import type { Member } from '../../types';
import type { RootStackParamList } from '../../navigation';
import Avatar from '../../components/Avatar';
import { PrimaryButton } from '../../components/Buttons';
import { Empty, ErrorNotice, Loading } from '../../components/Feedback';

const MAX_NOTE = 500;

export default function JobReferScreen() {
  const { id, authorId } = useRoute<RouteProp<RootStackParamList, 'JobRefer'>>().params;
  const navigation = useNavigation();

  const [members, setMembers] = useState<Member[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // Two calls because the directory doesn't say which row is you.
      const [directory, profile] = await Promise.all([getDirectory(), getProfile()]);
      setMembers(directory.members ?? []);
      setSelfId(profile.member.id);
      setError('');
    } catch (e) {
      setError(readableError(e));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const visible = useMemo(() => {
    const eligible = members.filter(
      (m) => !m.is_past_member && m.id !== authorId && m.id !== selfId,
    );
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((m) =>
      [m.name, m.location, ...toTypeList(m.member_types)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [members, query, authorId, selfId]);

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await referMember(id, {
        referred_member_id: selected.id,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      navigation.goBack();
    } catch (e) {
      // 409 here means this person was already referred to this post.
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-cream"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="px-3 pb-2 pt-2">
        <TextInput
          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-[15px] text-zinc-900"
          placeholder="Search members"
          placeholderTextColor="#a1a1aa"
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {error ? <ErrorNotice message={error} /> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Empty message="No one matches that search." />}
        renderItem={({ item }) => {
          const active = selected?.id === item.id;
          return (
            <TouchableOpacity
              className={`mb-2 flex-row items-center rounded-xl border bg-white px-3.5 py-3 ${
                active ? 'border-brand-blue' : 'border-black/5'
              }`}
              activeOpacity={0.7}
              onPress={() => setSelected(active ? null : item)}
            >
              <Avatar uri={item.avatar_url} name={item.name} size={38} />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-medium text-zinc-900">{item.name}</Text>
                {item.location ? (
                  <Text className="text-[12px] text-zinc-500">{item.location}</Text>
                ) : null}
              </View>
              {active ? (
                <Text className="text-[13px] font-bold text-brand-blue">Selected</Text>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />

      {selected ? (
        <View className="border-t border-black/5 bg-brand-cream px-4 pb-6 pt-3">
          <TextInput
            className="h-20 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-zinc-900"
            placeholder={`Why ${selected.name}? (optional)`}
            placeholderTextColor="#a1a1aa"
            multiline
            textAlignVertical="top"
            maxLength={MAX_NOTE}
            value={note}
            onChangeText={setNote}
            editable={!busy}
          />
          <PrimaryButton label={`Refer ${selected.name}`} busy={busy} onPress={submit} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
