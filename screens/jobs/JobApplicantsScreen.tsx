// Everyone who applied to one of YOUR posts.
//
// The endpoint 404s if the post isn't yours, so there's no ownership check
// to do here — a 404 just means "you shouldn't be looking at this".
//
// This is the one place the API hands out contact details (email, phone),
// because the poster needs a way to reply. Tapping them opens the phone's
// mail/dialer rather than showing anything in-app.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getJobApplications, readableError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { BRAND_BLUE } from '../../lib/theme';
import type { JobApplication } from '../../types';
import type { RootStackParamList } from '../../navigation';
import Avatar from '../../components/Avatar';
import Chip from '../../components/Chip';
import { Empty, ErrorNotice, Loading } from '../../components/Feedback';

export default function JobApplicantsScreen() {
  const { id, title } = useRoute<RouteProp<RootStackParamList, 'JobApplicants'>>().params;
  const navigation = useNavigation();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const load = useCallback(async () => {
    try {
      const data = await getJobApplications(id);
      setApplications(data.applications ?? []);
      setError('');
    } catch (e) {
      setError(readableError(e));
    }
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-brand-cream">
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          error ? null : <Empty message="No applications yet." />
        }
        renderItem={({ item }) => <ApplicantCard application={item} />}
      />
    </View>
  );
}

function ApplicantCard({ application }: { application: JobApplication }) {
  const { applicant } = application;

  // Contact rows only appear for details the applicant actually shared.
  const contacts: [string, string, string][] = [];
  if (applicant.email) contacts.push(['Email', applicant.email, `mailto:${applicant.email}`]);
  if (applicant.phone) contacts.push(['Phone', applicant.phone, `tel:${applicant.phone}`]);
  if (applicant.linkedin) contacts.push(['LinkedIn', 'Open profile', applicant.linkedin]);
  if (application.link) contacts.push(['Link', 'Open', application.link]);

  return (
    <View className="mb-2.5 rounded-2xl border border-black/5 bg-white p-4">
      <View className="flex-row items-center">
        <Avatar uri={applicant.avatar_url} name={applicant.name} size={44} />
        <View className="ml-3 flex-1">
          <Text className="text-[15px] font-semibold text-zinc-900">{applicant.name}</Text>
          {applicant.company_name ? (
            <Text className="text-[13px] text-zinc-500">{applicant.company_name}</Text>
          ) : null}
        </View>
        <Text className="text-[12px] text-zinc-400">{timeAgo(application.created_at)}</Text>
      </View>

      <View className="mt-2 flex-row flex-wrap gap-2">
        {/* External applicants came in through a share link — they aren't
            Exposure members, which is worth knowing before you reply. */}
        {applicant.is_external ? <Chip label="Not a member" tone="warn" /> : null}
        {application.referred_by_name ? (
          <Chip label={`Referred by ${application.referred_by_name}`} />
        ) : null}
      </View>

      {applicant.bio ? (
        <Text className="mt-2.5 text-[13px] leading-5 text-zinc-500" numberOfLines={3}>
          {applicant.bio}
        </Text>
      ) : null}

      <Text className="mt-3 text-[14px] leading-5 text-zinc-800">{application.pitch}</Text>

      {contacts.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2 border-t border-black/5 pt-3">
          {contacts.map(([label, display, url]) => (
            <TouchableOpacity
              key={label}
              className="rounded-full border border-brand-blue/20 bg-brand-blue/5 px-3.5 py-2"
              activeOpacity={0.7}
              onPress={() => Linking.openURL(url).catch(() => {})}
            >
              <Text className="text-[12px] font-semibold text-brand-blue">
                {label}: {display}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
