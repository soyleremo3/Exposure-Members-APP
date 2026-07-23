// One member's full profile, pushed from the directory (and from a match).
//
// The whole Member object arrives as a route param — the directory already
// fetched it, so there's nothing to load here. Note the directory endpoint
// deliberately omits email/phone/website for privacy; only the fields below
// exist.
//
// This mirrors the website's member modal, including the labels. Three of the
// fields are named after social networks but hold plain text: `bio` is the
// current occupation, `twitter` the area of interest, `instagram` the
// education. Only `linkedin`, `github` and `occupation_link` are real links.
// See the table at the top of API.md's Profile section.
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { toTypeList } from '../lib/format';
import { BRAND_BLUE } from '../lib/theme';
import type { Member } from '../types';
import type { RootStackParamList } from '../navigation';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';

// Members type these by hand, so plenty arrive without a scheme
// ("linkedin.com/in/x") — which openURL refuses to open.
function withScheme(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

export default function MemberDetailScreen() {
  const { member } = useRoute<RouteProp<RootStackParamList, 'MemberDetail'>>().params;
  const types = toTypeList(member.member_types);

  return (
    <ScrollView
      className="flex-1 bg-brand-cream"
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
    >
      <View className="flex-row items-center">
        <Avatar uri={member.avatar_url} name={member.name} size={88} />
        <View className="ml-4 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-shrink text-lg font-bold text-zinc-900">{member.name}</Text>
            {member.batch ? (
              <View className="rounded bg-zinc-100 px-1.5 py-0.5">
                <Text className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                  E{member.batch}
                </Text>
              </View>
            ) : null}
          </View>
          {member.location ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <Ionicons name="location-outline" size={14} color="#a1a1aa" />
              <Text className="flex-1 text-sm text-zinc-500">{member.location}</Text>
            </View>
          ) : null}
          {types.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap gap-1.5">
              {types.map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {member.is_past_member ? (
        <View className="mt-4 self-start">
          <Chip label="Past member" tone="warn" />
        </View>
      ) : null}

      {member.bio ? (
        <Field label="Current Occupation">
          <Text className="text-sm leading-6 text-zinc-800">{member.bio}</Text>
          {member.occupation_link ? (
            <TouchableOpacity
              className="mt-1.5 flex-row items-center gap-1"
              activeOpacity={0.7}
              onPress={() => Linking.openURL(withScheme(member.occupation_link!)).catch(() => {})}
            >
              <Ionicons name="globe-outline" size={12} color={BRAND_BLUE} />
              <Text className="text-xs text-brand-blue">
                {member.occupation_link.replace(/^https?:\/\//, '')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Field>
      ) : null}

      {member.twitter ? (
        <Field label="Area of Interest">
          <Text className="text-sm text-zinc-800">{member.twitter}</Text>
        </Field>
      ) : null}

      {member.instagram ? (
        <Field label="Education">
          <Text className="text-sm text-zinc-800">{member.instagram}</Text>
        </Field>
      ) : null}

      {member.favorite_resource ? (
        <Field label="Favorite Read / Video / Person">
          <Text className="text-sm leading-6 text-zinc-800">{member.favorite_resource}</Text>
        </Field>
      ) : null}

      {member.linkedin || member.github ? (
        <View className="mt-6 flex-row flex-wrap gap-2">
          <LinkButton icon="logo-linkedin" label="LinkedIn" url={member.linkedin} />
          <LinkButton icon="logo-github" label="GitHub" url={member.github} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </Text>
      {children}
    </View>
  );
}

function LinkButton({
  icon,
  label,
  url,
}: {
  icon: 'logo-linkedin' | 'logo-github';
  label: string;
  url?: string | null;
}) {
  if (!url) return null;
  return (
    <TouchableOpacity
      className="flex-row items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5"
      activeOpacity={0.7}
      onPress={() => Linking.openURL(withScheme(url)).catch(() => {})}
    >
      <Ionicons name={icon} size={14} color="#52525b" />
      <Text className="text-xs font-semibold text-zinc-600">{label}</Text>
    </TouchableOpacity>
  );
}
