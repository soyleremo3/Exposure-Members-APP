// Everything the community publishes, behind one tab: events, shared links,
// the newsletter, and YouTube.
//
// Four small read-only lists don't each deserve a tab of their own, so they
// share this screen with a segmented control. Each section fetches the first
// time it's opened and then keeps what it has — switching back and forth
// shouldn't re-hit the API.
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ApiError, getEvents, getLinks, getNewsletter, getYoutube, readableError } from '../lib/api';
import { formatDate } from '../lib/format';
import { BRAND_BLUE } from '../lib/theme';
import type { EventRecord, LinkGroup, NewsletterPost, YoutubeVideo } from '../types';
import Chip from '../components/Chip';
import { Empty, ErrorNotice, Loading } from '../components/Feedback';

type Section = 'events' | 'links' | 'newsletter' | 'youtube';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'links', label: 'Links' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'youtube', label: 'Videos' },
];

export default function DiscoverScreen() {
  const [section, setSection] = useState<Section>('events');

  return (
    <View className="flex-1 bg-brand-cream">
      <View className="flex-row gap-2 px-3 pb-1 pt-2">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              className={`rounded-full px-3 py-2 ${active ? 'bg-brand-blue' : 'bg-brand-blue/10'}`}
              activeOpacity={0.8}
              onPress={() => setSection(s.key)}
            >
              <Text
                className={`text-[13px] font-semibold ${
                  active ? 'text-brand-cream' : 'text-brand-blue'
                }`}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {section === 'events' ? <EventsSection /> : null}
      {section === 'links' ? <LinksSection /> : null}
      {section === 'newsletter' ? <NewsletterSection /> : null}
      {section === 'youtube' ? <YoutubeSection /> : null}
    </View>
  );
}

// Shared loading/refresh plumbing — every section below does the same three
// things (load once, pull to refresh, show an error strip).
function useSection<T>(fetcher: () => Promise<T>, empty: T) {
  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Set when the failure is "you need an active membership" rather than a
  // real error — the events endpoint is the only one that does this.
  const [needsMembership, setNeedsMembership] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetcher());
      setError('');
      setNeedsMembership(false);
    } catch (e) {
      setNeedsMembership(e instanceof ApiError && e.subscriptionRequired);
      setError(readableError(e));
    }
    // fetcher is a module-level function in every caller, so this is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, loading, refreshing, error, needsMembership, load, onRefresh };
}

// Pull the first non-empty string out of a list of candidate fields.
function pick(event: EventRecord, keys: string[]): string {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function EventsSection() {
  const { data, loading, refreshing, error, needsMembership, load, onRefresh } = useSection(
    () => getEvents().then((r) => r.events ?? []),
    [] as EventRecord[],
  );

  if (loading) return <Loading />;

  // Events is the one endpoint gated on an active membership. lib/api.ts
  // has already checked that the session itself is fine, so this is a
  // message, not a reason to throw the member out of the app.
  if (needsMembership) {
    return <Empty message="Events are open to members with an active membership. Manage yours on exposureai.org." />;
  }

  return (
    <FlatList
      data={data}
      // Events may lack an id — fall back to the list index.
      keyExtractor={(item, index) => String(item.id ?? index)}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
      ListHeaderComponent={error ? <ErrorNotice message={error} onRetry={load} /> : null}
      ListEmptyComponent={
        error ? null : <Empty message="No events right now — check back soon." />
      }
      renderItem={({ item }) => {
        // The events table is fed from an external calendar and its columns
        // change, so look under every plausible field name and skip the rest.
        const title = pick(item, ['title', 'name']) || 'Untitled event';
        const date = pick(item, ['date', 'start_time', 'starts_at', 'event_date']);
        const location = pick(item, ['location', 'venue', 'place']);
        const url = pick(item, ['url', 'link', 'event_url']);
        const description = pick(item, ['description', 'details']);

        const card = (
          <View className="mb-2.5 rounded-2xl border border-black/5 bg-white p-4">
            <Text className="text-[16px] font-semibold text-zinc-900">{title}</Text>
            {date ? (
              <Text className="mt-1 text-[13px] font-semibold text-brand-blue">
                {formatDate(date)}
              </Text>
            ) : null}
            {location ? <Text className="mt-0.5 text-[13px] text-zinc-500">{location}</Text> : null}
            {description ? (
              <Text className="mt-1.5 text-[14px] leading-5 text-zinc-600" numberOfLines={3}>
                {description}
              </Text>
            ) : null}
            {url ? (
              <Text className="mt-2 text-[13px] font-semibold text-brand-blue">
                Open event page →
              </Text>
            ) : null}
          </View>
        );

        // Only make the card tappable when there is actually a link.
        return url ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(url).catch(() => {})}>
            {card}
          </TouchableOpacity>
        ) : (
          card
        );
      }}
    />
  );
}

function LinksSection() {
  const { data, loading, refreshing, error, load, onRefresh } = useSection(
    () => getLinks().then((r) => r.groups ?? []),
    [] as LinkGroup[],
  );

  if (loading) return <Loading />;

  return (
    <FlatList
      data={data}
      keyExtractor={(group) => group.id}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
      ListHeaderComponent={error ? <ErrorNotice message={error} onRetry={load} /> : null}
      ListEmptyComponent={error ? null : <Empty message="No links shared yet." />}
      renderItem={({ item: group }) => (
        <View className="mb-4">
          <Text className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
            {formatDate(group.date_from)}
            {group.date_to ? ` – ${formatDate(group.date_to)}` : ''}
          </Text>
          {group.links.map((link, index) => (
            <TouchableOpacity
              key={`${group.id}-${index}`}
              className="mb-2 rounded-2xl border border-black/5 bg-white p-3.5"
              activeOpacity={0.8}
              onPress={() => Linking.openURL(link.url).catch(() => {})}
            >
              <Text className="text-[15px] font-semibold text-zinc-900">
                {link.title || link.label || link.url}
              </Text>
              {link.description || link.notes ? (
                <Text className="mt-1 text-[13px] leading-5 text-zinc-600" numberOfLines={3}>
                  {link.description || link.notes}
                </Text>
              ) : null}
              {link.type ? (
                <View className="mt-2">
                  <Chip label={link.type} />
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    />
  );
}

function NewsletterSection() {
  const { data, loading, refreshing, error, load, onRefresh } = useSection(
    () => getNewsletter().then((r) => r.posts ?? []),
    [] as NewsletterPost[],
  );

  if (loading) return <Loading />;

  return (
    <FlatList
      data={data}
      keyExtractor={(post) => post.id}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
      ListHeaderComponent={error ? <ErrorNotice message={error} onRetry={load} /> : null}
      ListEmptyComponent={error ? null : <Empty message="No newsletter issues yet." />}
      renderItem={({ item }) => (
        <TouchableOpacity
          className="mb-2.5 overflow-hidden rounded-2xl border border-black/5 bg-white"
          activeOpacity={0.8}
          onPress={() => Linking.openURL(item.web_url).catch(() => {})}
        >
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={{ width: '100%', height: 150 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <View className="p-4">
            <Text className="text-[16px] font-semibold text-zinc-900">{item.title}</Text>
            {item.subtitle ? (
              <Text className="mt-1 text-[14px] leading-5 text-zinc-600" numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
            {item.publish_date ? (
              <Text className="mt-2 text-[12px] text-zinc-400">{formatDate(item.publish_date)}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function YoutubeSection() {
  const { data, loading, refreshing, error, load, onRefresh } = useSection(
    () => getYoutube(),
    { longForm: [] as YoutubeVideo[], shorts: [] as YoutubeVideo[] },
  );

  if (loading) return <Loading />;

  // The API splits videos into two lists; showing them as one feed is
  // simpler, and `is_short` already labels which is which.
  const videos = [...(data.longForm ?? []), ...(data.shorts ?? [])];

  return (
    <FlatList
      data={videos}
      keyExtractor={(video) => video.id}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
      ListHeaderComponent={error ? <ErrorNotice message={error} onRetry={load} /> : null}
      ListEmptyComponent={error ? null : <Empty message="No videos to show." />}
      renderItem={({ item }) => (
        <TouchableOpacity
          className="mb-2.5 flex-row items-center rounded-2xl border border-black/5 bg-white p-3"
          activeOpacity={0.8}
          // Videos open in the YouTube app / browser. No embedded player —
          // it's a dependency and a maintenance cost for little gain.
          onPress={() => Linking.openURL(item.youtube_url).catch(() => {})}
        >
          {item.thumbnail_urls?.[0] ? (
            <Image
              source={{ uri: item.thumbnail_urls[0] }}
              style={{ width: 96, height: 64, borderRadius: 8 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <View className="ml-3 flex-1">
            <Text className="text-[14px] font-semibold leading-5 text-zinc-900" numberOfLines={3}>
              {item.title}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              {item.is_short ? <Chip label="Short" /> : null}
              {item.published_at ? (
                <Text className="text-[12px] text-zinc-400">{formatDate(item.published_at)}</Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
