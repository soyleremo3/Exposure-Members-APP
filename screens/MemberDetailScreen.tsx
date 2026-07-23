// One member's full profile, pushed from the directory (and from a match).
//
// The whole Member object arrives as a route param — the directory already
// fetched it, so there's nothing to load here. Note the directory endpoint
// deliberately omits email/phone/website for privacy; only the fields below
// exist.
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { toTypeList } from '../lib/format';
import type { Member } from '../types';
import type { RootStackParamList } from '../navigation';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';

// One row of link buttons. Only renders links the member actually filled in.
export function SocialLinks({ member }: { member: Member }) {
  // Keep label → url pairs together so adding a new social is one line.
  const links: [string, string | null | undefined][] = [
    ['LinkedIn', member.linkedin],
    ['Twitter', member.twitter],
    ['Instagram', member.instagram],
    ['GitHub', member.github],
    ['Work', member.occupation_link],
  ];
  const present = links.filter(([, url]) => !!url);
  if (present.length === 0) return null;

  return (
    <View className="mt-4 flex-row flex-wrap gap-2">
      {present.map(([label, url]) => (
        <TouchableOpacity
          key={label}
          className="rounded-full border border-brand-blue/20 bg-brand-blue/5 px-4 py-2"
          activeOpacity={0.7}
          onPress={() => Linking.openURL(url as string).catch(() => {})}
        >
          <Text className="text-[13px] font-semibold text-brand-blue">{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MemberDetailScreen() {
  const { member } = useRoute<RouteProp<RootStackParamList, 'MemberDetail'>>().params;
  const types = toTypeList(member.member_types);

  return (
    <ScrollView
      className="flex-1 bg-brand-cream"
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
    >
      <View className="items-center">
        <Avatar uri={member.avatar_url} name={member.name} size={96} />
        <Text className="mt-3 text-center text-2xl font-bold text-zinc-900">{member.name}</Text>
        {member.location ? (
          <Text className="mt-1 text-[15px] text-zinc-500">{member.location}</Text>
        ) : null}
        {member.is_past_member ? (
          <View className="mt-2">
            <Chip label="Past member" tone="warn" />
          </View>
        ) : null}
      </View>

      {types.length > 0 ? (
        <View className="mt-5 flex-row flex-wrap gap-2">
          {types.map((t) => (
            <Chip key={t} label={t} />
          ))}
        </View>
      ) : null}

      {member.bio ? (
        <Text className="mt-5 text-[15px] leading-6 text-zinc-700">{member.bio}</Text>
      ) : null}

      {member.favorite_resource ? (
        <View className="mt-5 rounded-2xl border border-black/5 bg-white p-4">
          <Text className="text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
            Favorite resource
          </Text>
          <Text className="mt-1 text-[15px] text-zinc-800">{member.favorite_resource}</Text>
        </View>
      ) : null}

      <SocialLinks member={member} />

      {member.batch != null ? (
        <Text className="mt-6 text-center text-[13px] text-zinc-400">Batch {member.batch}</Text>
      ) : null}
    </ScrollView>
  );
}
