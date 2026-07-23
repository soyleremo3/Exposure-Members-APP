// Weekly 1:1 matching.
//
// One GET returns the whole picture (current round, whether you opted in,
// who you got, last week's unconfirmed meeting, your history), so this is a
// single screen with several sections rather than a flow. Every action —
// opting in, confirming you met — is the same POST with a different field,
// and afterwards we just refetch instead of patching state by hand.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getMatch, postMatch } from '../lib/api';
import { formatDate, toTypeList } from '../lib/format';
import { BRAND_BLUE, BRAND_CREAM } from '../lib/theme';
import type { MatchData, Member } from '../types';
import type { RootStackParamList } from '../navigation';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';
import { Empty, ErrorNotice, Loading } from '../components/Feedback';

export default function MatchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await getMatch());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matches.');
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

  // Both buttons on this screen are the same POST. Refetch afterwards so the
  // server stays the source of truth about what state the round is in.
  async function send(payload: { round_id: string; opted_in?: boolean; confirmed_met?: boolean }) {
    setBusy(true);
    setError('');
    try {
      await postMatch(payload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const round = data?.currentRound ?? null;
  const optedIn = !!data?.myResponse?.opted_in;
  const matched = round?.status === 'matched' && data?.myCurrentMatch;

  return (
    <ScrollView
      className="flex-1 bg-brand-cream"
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
    >
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      {/* Last round's partner, still unconfirmed. Shown first because it's
          the one thing the member is being asked to act on. */}
      {data?.pendingConfirmation ? (
        <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="text-[15px] font-semibold text-amber-900">
            Did you meet {data.pendingConfirmation.member.name}?
          </Text>
          <Text className="mt-1 text-[13px] text-amber-800">
            Confirming helps us avoid pairing you again too soon.
          </Text>
          <TouchableOpacity
            className="mt-3 items-center rounded-full bg-amber-600 py-3"
            activeOpacity={0.85}
            disabled={busy}
            onPress={() =>
              send({ round_id: data.pendingConfirmation!.round_id, confirmed_met: true })
            }
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-bold text-white">Yes, we met</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {!round ? (
        <Empty message="No matching round is open right now. Check back at the start of the week." />
      ) : matched ? (
        <View>
          <Text className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
            Week of {formatDate(round.week_of)}
          </Text>
          <Text className="mb-4 text-2xl font-bold text-zinc-900">This week you're matched with</Text>

          <PartnerCard
            member={data!.myCurrentMatch!}
            onPress={() =>
              navigation.navigate('MemberDetail', { member: data!.myCurrentMatch! })
            }
          />

          {/* isOpener decides who breaks the ice, so neither person waits
              for the other. It can be null when the server hasn't decided. */}
          {data?.isOpener === true ? (
            <View className="mt-3 rounded-2xl bg-brand-blue/10 p-4">
              <Text className="text-[15px] font-semibold text-brand-blue">
                You're up — send the first message.
              </Text>
            </View>
          ) : data?.isOpener === false ? (
            <View className="mt-3 rounded-2xl bg-zinc-100 p-4">
              <Text className="text-[15px] text-zinc-600">
                They'll reach out first. Feel free to beat them to it.
              </Text>
            </View>
          ) : null}

          {data && data.currentMatchHistory.length > 0 ? (
            <>
              <Text className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
                Who they've met before
              </Text>
              {data.currentMatchHistory.map((entry) => (
                <HistoryRow
                  key={`${entry.round_id}-${entry.partner.id}`}
                  name={entry.partner.name}
                  avatar={entry.partner.avatar_url}
                  meta={formatDate(entry.week_of)}
                  onPress={() => navigation.navigate('MemberDetail', { member: entry.partner })}
                />
              ))}
            </>
          ) : null}
        </View>
      ) : optedIn ? (
        <View className="rounded-2xl border border-black/5 bg-white p-5">
          <Text className="text-[17px] font-bold text-zinc-900">You're in this week</Text>
          <Text className="mt-1.5 text-[14px] leading-5 text-zinc-600">
            Matches for the week of {formatDate(round.week_of)} go out once everyone has
            answered. We'll show your partner here.
          </Text>
          <TouchableOpacity
            className="mt-4 items-center rounded-full border border-black/10 py-3"
            activeOpacity={0.7}
            disabled={busy}
            onPress={() => send({ round_id: round.id, opted_in: false })}
          >
            <Text className="text-[14px] font-semibold text-zinc-600">Count me out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="rounded-2xl border border-black/5 bg-white p-5">
          <Text className="text-[17px] font-bold text-zinc-900">
            Meet another member this week
          </Text>
          <Text className="mt-1.5 text-[14px] leading-5 text-zinc-600">
            Opt in and we'll pair you with someone from the community for a 1:1 — coffee, a
            call, whatever works.
          </Text>
          <TouchableOpacity
            className="mt-4 items-center rounded-full bg-brand-blue py-3.5"
            activeOpacity={0.85}
            disabled={busy}
            onPress={() => send({ round_id: round.id, opted_in: true })}
          >
            {busy ? (
              <ActivityIndicator color={BRAND_CREAM} />
            ) : (
              <Text className="text-[15px] font-bold text-brand-cream">Count me in</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {data && data.matchHistory.length > 0 ? (
        <>
          <Text className="mb-2 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
            Your past matches
          </Text>
          {data.matchHistory.map((entry) => (
            <HistoryRow
              key={`${entry.round_id}-${entry.partner.id}`}
              name={entry.partner.name}
              avatar={entry.partner.avatar_url}
              meta={formatDate(entry.week_of)}
              met={entry.confirmed_met ?? undefined}
              onPress={() => navigation.navigate('MemberDetail', { member: entry.partner })}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function PartnerCard({ member, onPress }: { member: Member; onPress: () => void }) {
  const types = toTypeList(member.member_types);
  return (
    <TouchableOpacity
      className="rounded-2xl border border-black/5 bg-white p-5"
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Avatar uri={member.avatar_url} name={member.name} size={64} />
        <View className="ml-4 flex-1">
          <Text className="text-[19px] font-bold text-zinc-900">{member.name}</Text>
          {member.location ? (
            <Text className="mt-0.5 text-[14px] text-zinc-500">{member.location}</Text>
          ) : null}
        </View>
      </View>
      {types.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {types.map((t) => (
            <Chip key={t} label={t} />
          ))}
        </View>
      ) : null}
      {member.bio ? (
        <Text className="mt-3 text-[14px] leading-5 text-zinc-700" numberOfLines={4}>
          {member.bio}
        </Text>
      ) : null}
      <Text className="mt-3 text-[13px] font-semibold text-brand-blue">See full profile →</Text>
    </TouchableOpacity>
  );
}

function HistoryRow({
  name,
  avatar,
  meta,
  met,
  onPress,
}: {
  name: string;
  avatar?: string | null;
  meta: string;
  met?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="mb-2 flex-row items-center rounded-xl border border-black/5 bg-white px-3.5 py-3"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Avatar uri={avatar} name={name} size={38} />
      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-medium text-zinc-900">{name}</Text>
        <Text className="text-[12px] text-zinc-500">{meta}</Text>
      </View>
      {met ? <Chip label="Met" /> : null}
    </TouchableOpacity>
  );
}
