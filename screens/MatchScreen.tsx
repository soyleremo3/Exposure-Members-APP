// Weekly 1:1 matching ("1-on-1 Match" on the website).
//
// One GET returns the whole picture (current round, whether you opted in, who
// you got, last week's unconfirmed meeting, your history). The screen is a
// single scroll with several sections whose visibility is derived from
// `currentRound.status` + `myResponse` + `myCurrentMatch` — there is no state
// field, the same way the website computes it (see API.md → Match).
//
// Every action — opting in, confirming you met — is the same POST with a
// different field; afterwards we refetch so the server stays the source of
// truth. Two ephemeral flags (`confirmationDone`, `lateOptInDone`) hide/replace
// a block optimistically until the refetch lands, matching the website.
//
// The Auto opt-in toggle needs the member's profile (the match payload doesn't
// carry it), so this screen fetches profile alongside match. On the website
// that toggle is hidden on mobile widths; we show it, since this app is mobile
// only and the setting would otherwise be unreachable.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  getMatch,
  postMatch,
  getProfile,
  updateProfile,
  isReadOnlyError,
  READ_ONLY_NOTICE,
} from '../lib/api';
import { BRAND_BLUE } from '../lib/theme';
import type { MatchData, MatchPartner, SelfMember } from '../types';
import type { RootStackParamList } from '../navigation';
import Avatar from '../components/Avatar';
import { ErrorNotice, InfoNotice, Loading } from '../components/Feedback';

// "Jul 20" — the website renders week_of without a year.
function weekOf(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

export default function MatchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [data, setData] = useState<MatchData | null>(null);
  const [self, setSelf] = useState<SelfMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [error, setError] = useState('');

  // Optimistic UI, reset on every (re)load — see file header.
  const [confirmationDone, setConfirmationDone] = useState(false);
  const [lateOptInDone, setLateOptInDone] = useState(false);

  const load = useCallback(async () => {
    try {
      // Profile is a best-effort side fetch for the preferences toggle; a
      // failure there shouldn't blank out the whole match screen.
      const [match, profile] = await Promise.all([
        getMatch(),
        getProfile().catch(() => null),
      ]);
      setData(match);
      if (profile) setSelf(profile.member);
      setConfirmationDone(false);
      setLateOptInDone(false);
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

  async function send(payload: { round_id: string; opted_in?: boolean; confirmed_met?: boolean }) {
    setBusy(true);
    setError('');
    try {
      await postMatch(payload);
      await load();
    } catch (e) {
      // A read-only test account can't write; the optimistic flags already
      // reflected the tap, so mirror the website and stay quiet.
      if (isReadOnlyError(e)) return;
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto() {
    if (!self) return;
    setTogglingAuto(true);
    try {
      const res = await updateProfile({ auto_opt_in: !self.auto_opt_in });
      setSelf(res.member);
    } catch (e) {
      if (isReadOnlyError(e)) return;
      setError(e instanceof Error ? e.message : 'Could not update preference.');
    } finally {
      setTogglingAuto(false);
    }
  }

  if (loading) return <Loading />;

  const round = data?.currentRound ?? null;
  // Test accounts are GET-only (backend proxy.ts). Tell the tester up front so
  // the untouched toggle and unsaved opt-ins read as expected, not broken.
  const readOnly = self?.member_category === 'test';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
      >
        <Text className="text-xl font-bold text-body">1-on-1 Match</Text>
        <Text className="mt-1 text-sm text-faint">
          Get matched with another Exposure member for a 30-min call.
        </Text>

        <View className="mt-3">
          {readOnly ? <InfoNotice message={READ_ONLY_NOTICE} /> : null}
          {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        </View>

        {/* Last week's partner, still unconfirmed — asked about first because
            it's the one thing needing action. */}
        {data?.pendingConfirmation && !confirmationDone ? (
          <View className="mt-5 rounded-2xl border border-amber-500/30 bg-surface p-5">
            <Text className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Last Week&apos;s Match
            </Text>
            <View className="mb-4 flex-row items-center">
              <Avatar
                uri={data.pendingConfirmation.member.avatar_url}
                name={data.pendingConfirmation.member.name}
                size={40}
              />
              <View className="ml-3">
                <Text className="text-sm font-medium text-body">
                  {data.pendingConfirmation.member.name}
                </Text>
                <Text className="text-xs text-faint">Did you meet with them?</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 items-center rounded-xl bg-emerald-600 py-2.5"
                activeOpacity={0.85}
                disabled={busy}
                onPress={() => {
                  setConfirmationDone(true);
                  send({ round_id: data.pendingConfirmation!.round_id, confirmed_met: true });
                }}
              >
                <Text className="text-sm font-semibold text-white">Yes, we met</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 items-center rounded-xl bg-chip py-2.5"
                activeOpacity={0.7}
                disabled={busy}
                onPress={() => {
                  setConfirmationDone(true);
                  send({ round_id: data.pendingConfirmation!.round_id, confirmed_met: false });
                }}
              >
                <Text className="text-sm font-semibold text-muted">No, we didn&apos;t</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!round ? (
          <View className="mt-5 items-center rounded-2xl border border-hairline bg-surface p-10">
            <Ionicons name="swap-horizontal" size={36} color="#d4d4d8" />
            <Text className="mt-4 text-base font-semibold text-body">No round this week yet</Text>
            <Text className="mt-1.5 text-center text-sm text-faint">
              We&apos;ll send you an email when the next round opens.
            </Text>
          </View>
        ) : (
          <View className="mt-5 rounded-2xl border border-hairline bg-surface p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                This Week
              </Text>
              <Text className="text-[10px] font-bold text-faint">Week of {weekOf(round.week_of)}</Text>
            </View>

            {round.status === 'open' && !data?.myResponse ? (
              <View>
                <Text className="mb-5 text-sm leading-6 text-muted">
                  Ready for a 30-minute 1-on-1 with another Exposure member this week?
                </Text>
                <View className="flex-row gap-3">
                  <ActionButton
                    label="I'm in"
                    busy={busy}
                    tone="primary"
                    onPress={() => send({ round_id: round.id, opted_in: true })}
                  />
                  <ActionButton
                    label="Not this week"
                    disabled={busy}
                    tone="muted"
                    onPress={() => send({ round_id: round.id, opted_in: false })}
                  />
                </View>
              </View>
            ) : null}

            {round.status === 'open' && data?.myResponse?.opted_in === true ? (
              <View>
                <StatusBox
                  icon="checkmark-circle"
                  iconColor="#059669"
                  className="border-emerald-500/20 bg-emerald-500/10"
                  title="You're in for this week"
                  titleClass="text-emerald-700"
                  subtitle="We'll email you your match when the round runs."
                  subtitleClass="text-emerald-600/80"
                />
                <TextLink label="Change mind — opt out" disabled={busy}
                  onPress={() => send({ round_id: round.id, opted_in: false })} />
              </View>
            ) : null}

            {round.status === 'open' && data?.myResponse?.opted_in === false ? (
              <View>
                <StatusBox
                  icon="close"
                  iconColor="#a1a1aa"
                  className="border-hairline bg-chip"
                  title="Sitting out this week"
                  titleClass="text-muted"
                  subtitle="No worries — you can always join next round."
                  subtitleClass="text-faint"
                />
                <TextLink label="Change mind — opt in" disabled={busy}
                  onPress={() => send({ round_id: round.id, opted_in: true })} />
              </View>
            ) : null}

            {round.status === 'matched' && data?.myCurrentMatch ? (
              <PartnerBlock
                partner={data.myCurrentMatch}
                isOpener={data.isOpener}
                onOpenProfile={() =>
                  navigation.navigate('MemberDetail', { member: data.myCurrentMatch! })
                }
              />
            ) : null}

            {round.status === 'matched' && !data?.myCurrentMatch ? (
              lateOptInDone ? (
                <StatusBox
                  icon="checkmark-circle"
                  iconColor={BRAND_BLUE}
                  className="border-brand-blue/30 bg-brand-blue/10"
                  title="You're in for a late match"
                  titleClass="text-accent-link"
                  subtitle="We'll try to pair you with someone who also missed the round."
                  subtitleClass="text-brand-blue/70"
                />
              ) : (
                <View className="items-center py-6">
                  <Text className="mb-1 text-sm font-medium text-muted">Missed this round?</Text>
                  <Text className="mb-5 text-center text-xs text-faint">
                    Matches just went out — you can still raise your hand for a late pairing.
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center justify-center rounded-xl bg-brand-blue px-6 py-2.5"
                    activeOpacity={0.85}
                    disabled={busy}
                    onPress={() => {
                      setLateOptInDone(true);
                      send({ round_id: round.id, opted_in: true });
                    }}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-sm font-semibold text-white">Late opt-in</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )
            ) : null}

            {round.status === 'closed' ? (
              <View className="items-center py-6">
                <Text className="text-center text-sm text-faint">
                  This round has closed. We&apos;ll email you when the next one opens.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {data && data.matchHistory.length > 0 ? (
          <View className="mt-4 rounded-2xl border border-hairline bg-surface p-5">
            <Text className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Your Match History
            </Text>
            {data.matchHistory.map((entry) => (
              <TouchableOpacity
                key={entry.round_id}
                className="mb-1 flex-row items-center rounded-xl px-1 py-2"
                activeOpacity={0.7}
                onPress={() => navigation.navigate('MemberDetail', { member: entry.partner })}
              >
                <Avatar uri={entry.partner.avatar_url} name={entry.partner.name} size={36} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium text-body" numberOfLines={1}>
                    {entry.partner.name}
                  </Text>
                  {entry.partner.bio ? (
                    <Text className="text-xs text-faint" numberOfLines={1}>
                      {entry.partner.bio}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-faint">
                    {new Date(entry.week_of).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                {entry.confirmed_met === true ? (
                  <MetBadge label="Met" tone="met" />
                ) : entry.confirmed_met === false ? (
                  <MetBadge label="Didn't meet" tone="missed" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Preferences. Hidden on the website's mobile width; shown here so the
            setting stays reachable. */}
        {self ? (
          <View className="mt-4 rounded-2xl border border-hairline bg-surface p-5">
            <Text className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Preferences
            </Text>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-body">Auto opt-in</Text>
                <Text className="mt-0.5 text-[11px] leading-5 text-faint">
                  {self.auto_opt_in
                    ? 'On — You will join every round automatically.'
                    : 'Off — you choose each week.'}
                </Text>
              </View>
              <TouchableOpacity
                className={`mt-0.5 h-6 w-11 justify-center rounded-full px-0.5 ${
                  self.auto_opt_in ? 'bg-brand-blue' : 'bg-zinc-300'
                } ${togglingAuto ? 'opacity-50' : ''}`}
                activeOpacity={0.8}
                disabled={togglingAuto}
                onPress={toggleAuto}
              >
                <View
                  className={`h-5 w-5 rounded-full bg-surface ${self.auto_opt_in ? 'self-end' : 'self-start'}`}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PartnerBlock({
  partner,
  isOpener,
  onOpenProfile,
}: {
  partner: MatchPartner;
  isOpener: boolean | null;
  onOpenProfile: () => void;
}) {
  const first = firstName(partner.name);
  return (
    <View>
      <Text className="mb-3 text-xs text-faint">
        You&apos;ve been matched! Schedule your 30-min call.
      </Text>

      {/* Who reaches out first is randomly assigned, so neither person waits. */}
      {isOpener !== null ? (
        <View
          className={`mb-4 flex-row items-start gap-3 rounded-xl border px-4 py-3.5 ${
            isOpener ? 'border-blue-500/30 bg-blue-500/10' : 'border-amber-500/30 bg-amber-500/10'
          }`}
        >
          <Text className="text-xl">{isOpener ? '👋' : '📬'}</Text>
          <View className="flex-1">
            <Text className={`text-sm font-bold ${isOpener ? 'text-blue-700' : 'text-amber-700'}`}>
              {isOpener
                ? `You should reach out to ${first} first`
                : `${first} will reach out to you`}
            </Text>
            <Text className={`mt-0.5 text-xs ${isOpener ? 'text-blue-600/80' : 'text-amber-600/80'}`}>
              {isOpener
                ? "It's your responsibility to reach out this week. (Who goes first is randomly chosen.)"
                : `It's ${first}'s responsibility to reach out this week. (Who goes first is randomly chosen.)`}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="rounded-xl bg-surface-2 p-5">
        <TouchableOpacity className="flex-row items-center" activeOpacity={0.7} onPress={onOpenProfile}>
          <Avatar uri={partner.avatar_url} name={partner.name} size={56} />
          <View className="ml-4 flex-1">
            <Text className="text-base font-semibold text-body">{partner.name}</Text>
            {partner.location ? (
              <View className="mt-0.5 flex-row items-center gap-1">
                <Ionicons name="location-outline" size={12} color="#a1a1aa" />
                <Text className="text-xs text-faint">{partner.location}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {partner.bio ? (
          <View className="mt-4">
            <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Occupation
            </Text>
            <Text className="text-sm text-body">{partner.bio}</Text>
          </View>
        ) : null}

        <View className="mt-4 border-t border-hairline pt-4">
          {partner.email ? (
            <TouchableOpacity
              className="mb-2 flex-row items-center gap-2"
              activeOpacity={0.7}
              onPress={() => Linking.openURL(`mailto:${partner.email}`).catch(() => {})}
            >
              <Ionicons name="mail-outline" size={14} color="#a1a1aa" />
              <Text className="flex-1 text-sm text-accent-link" numberOfLines={1}>
                {partner.email}
              </Text>
            </TouchableOpacity>
          ) : null}
          {partner.phone ? (
            <View className="mb-2 flex-row items-center gap-2">
              <Ionicons name="call-outline" size={14} color="#a1a1aa" />
              <Text className="text-sm text-body">{partner.phone}</Text>
            </View>
          ) : null}

          {partner.linkedin || partner.github ? (
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              <ContactLink icon="logo-linkedin" label="LinkedIn" url={partner.linkedin} />
              <ContactLink icon="logo-github" label="GitHub" url={partner.github} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ContactLink({
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
      className="flex-row items-center gap-1.5 rounded-lg bg-chip px-3 py-1.5"
      activeOpacity={0.7}
      onPress={() => Linking.openURL(href).catch(() => {})}
    >
      <Ionicons name={icon} size={14} color="#8a8a94" />
      <Text className="text-xs font-semibold text-muted">{label}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  onPress,
  busy,
  disabled,
  tone,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone: 'primary' | 'muted';
}) {
  const box = tone === 'primary' ? 'bg-brand-blue' : 'bg-chip';
  const text = tone === 'primary' ? 'text-white' : 'text-muted';
  return (
    <TouchableOpacity
      className={`flex-1 items-center rounded-xl py-3 ${box} ${busy || disabled ? 'opacity-50' : ''}`}
      activeOpacity={0.85}
      disabled={busy || disabled}
      onPress={onPress}
    >
      {busy && tone === 'primary' ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`text-sm font-semibold ${text}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function StatusBox({
  icon,
  iconColor,
  className,
  title,
  titleClass,
  subtitle,
  subtitleClass,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  className: string;
  title: string;
  titleClass: string;
  subtitle: string;
  subtitleClass: string;
}) {
  return (
    <View className={`flex-row items-center gap-3 rounded-xl border p-4 ${className}`}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View className="flex-1">
        <Text className={`text-sm font-medium ${titleClass}`}>{title}</Text>
        <Text className={`mt-0.5 text-xs ${subtitleClass}`}>{subtitle}</Text>
      </View>
    </View>
  );
}

function TextLink({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity className="mt-3" activeOpacity={0.7} disabled={disabled} onPress={onPress}>
      <Text className="text-xs text-faint">{label}</Text>
    </TouchableOpacity>
  );
}

function MetBadge({ label, tone }: { label: string; tone: 'met' | 'missed' }) {
  const style =
    tone === 'met'
      ? { box: 'border border-emerald-500/20 bg-emerald-500/10', text: 'text-emerald-600' }
      : { box: 'bg-chip', text: 'text-faint' };
  return (
    <View className={`rounded-full px-2 py-0.5 ${style.box}`}>
      <Text className={`text-[10px] font-semibold ${style.text}`}>{label}</Text>
    </View>
  );
}
