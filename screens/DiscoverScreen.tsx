// Everything the community publishes, behind one tab: events, shared links,
// the newsletter ("Overexposed"), and YouTube.
//
// These read-only lists don't each deserve a tab, so they share this screen
// with a horizontally scrollable segmented control (kept scrollable because
// more sections — Refer a Friend, Community Brain — land here in later steps).
// Each section fetches the first time it's opened and then keeps what it has.
//
// Every section mirrors the website's header (title + subtitle + optional badge
// + optional action) and card layout. Field quirks worth knowing:
//   • events are raw table rows; `type` is 'In-person'/'Online', photos live in
//     `images[]`, and an older schema used image_url/attendee_count/is_past.
//   • newsletter `publish_date` is a UNIX timestamp in SECONDS (× 1000).
//   • the Subscribe URL isn't in the API — it's derived from the newest post.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, getEvents, getLinks, getNewsletter, getYoutube, readableError } from '../lib/api';
import { toImageList } from '../lib/format';
import { resizedImage } from '../lib/images';
import { BRAND_BLUE } from '../lib/theme';
import type { EventRecord, LinkGroup, NewsletterPost, SharedLink, YoutubeVideo } from '../types';
import { Empty, ErrorNotice, Loading } from '../components/Feedback';

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UC3HbxGtKcJOEh3y46ze3Buw';

type Section = 'events' | 'links' | 'newsletter' | 'youtube';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'links', label: 'Links' },
  { key: 'newsletter', label: 'Overexposed' },
  { key: 'youtube', label: 'YouTube' },
];

export default function DiscoverScreen() {
  const [section, setSection] = useState<Section>('events');

  return (
    <SafeAreaView className="flex-1 bg-brand-cream" edges={['top']}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-14 flex-grow-0"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      >
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              className={`self-start rounded-full px-4 py-2 ${
                active ? 'bg-brand-blue' : 'bg-brand-blue/10'
              }`}
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
      </ScrollView>

      <View className="flex-1">
        {section === 'events' ? <EventsSection /> : null}
        {section === 'links' ? <LinksSection /> : null}
        {section === 'newsletter' ? <NewsletterSection /> : null}
        {section === 'youtube' ? <YoutubeSection /> : null}
      </View>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------ shared

// Load once, pull to refresh, show an error strip — every section does this.
function useSection<T>(fetcher: () => Promise<T>, empty: T) {
  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Set when the failure is "you need an active membership" rather than a real
  // error — the events endpoint is the only one that does this.
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

// Section title block: heading + subtitle, plus optional inline badge and a
// right-aligned action (Subscribe buttons).
function SectionHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle: string;
  badge?: { label: string; className: string };
  action?: React.ReactNode;
}) {
  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl font-bold text-zinc-900">{title}</Text>
          {badge ? (
            <View className={`rounded-full px-2 py-0.5 ${badge.className}`}>
              <Text className="text-[10px] font-bold uppercase tracking-wider">{badge.label}</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-sm text-zinc-500">{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}

// "3 June 2026" — used by both events and the newsletter.
function longDate(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ------------------------------------------------------------------- events

function EventsSection() {
  const { data, loading, refreshing, error, needsMembership, load, onRefresh } = useSection(
    () => getEvents().then((r) => r.events ?? []),
    [] as EventRecord[],
  );
  // One gallery for the whole list, opened by any card — mirrors the website's
  // single lightbox.
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);

  if (loading) return <Loading />;

  if (needsMembership) {
    return (
      <Empty message="Events are open to members with an active membership. Manage yours on exposureai.org." />
    );
  }

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item, index) => String(item.id ?? index)}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListHeaderComponent={
          <>
            <SectionHeader title="Events" subtitle="Past and upcoming Exposure gatherings." />
            {error ? <ErrorNotice message={error} onRetry={load} /> : null}
          </>
        }
        ListEmptyComponent={error ? null : <Empty message="No events yet." />}
        renderItem={({ item }) => (
          <EventCard event={item} onOpenPhotos={(images, index) => setGallery({ images, index })} />
        )}
      />
      {gallery ? (
        <ImageGallery
          images={gallery.images}
          index={gallery.index}
          onClose={() => setGallery(null)}
        />
      ) : null}
    </>
  );
}

function EventCard({
  event,
  onOpenPhotos,
}: {
  event: EventRecord;
  onOpenPhotos: (images: string[], index: number) => void;
}) {
  // Normalize the two possible schemas (see EventRecord in types.ts) and the
  // occasional stringified array (see toImageList).
  const images = toImageList(event.images ?? event.image_url);
  const type = /online/i.test(String(event.type)) ? 'Online' : 'In-person';
  const attendees = event.attendees ?? event.attendee_count ?? 0;
  const upcoming = event.upcoming ?? (event.is_past != null ? !event.is_past : false);

  return (
    <View
      className={`mb-3 overflow-hidden rounded-2xl border ${
        upcoming ? 'border-brand-blue/30 bg-brand-blue/5' : 'border-black/5 bg-white'
      }`}
    >
      {images.length > 0 ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenPhotos(images, 0)}>
          <View>
            <RemoteImage
              url={images[0]}
              width={800}
              style={{ width: '100%', height: 176 }}
            />
            {/* Photo-count pill, bottom-right, like the website's grid badge. */}
            {images.length > 1 ? (
              <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-black/60 px-2 py-1">
                <Ionicons name="images-outline" size={11} color="#fff" />
                <Text className="text-[10px] font-semibold text-white">{images.length}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

      <View className="p-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-zinc-900">
            {event.title || 'Untitled event'}
          </Text>
          {upcoming ? (
            <View className="flex-row items-center gap-1 rounded-full bg-brand-blue px-2 py-0.5">
              <Ionicons name="sparkles" size={9} color="#fff" />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                Upcoming
              </Text>
            </View>
          ) : null}
          <View
            className={`rounded-full px-2 py-0.5 ${
              type === 'In-person' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
            }`}
          >
            <Text
              className={`text-[10px] font-bold ${
                type === 'In-person' ? 'text-emerald-600' : 'text-blue-500'
              }`}
            >
              {type}
            </Text>
          </View>
          {images.length > 1 ? (
            <Text className="text-[10px] text-zinc-400">{images.length} photos</Text>
          ) : null}
        </View>

        {event.description ? (
          <Text className="mt-1.5 text-xs leading-5 text-zinc-500">{event.description}</Text>
        ) : null}

        <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
          {event.date ? (
            <MetaRow icon="calendar-outline" text={longDate(event.date)} />
          ) : null}
          {event.location ? <MetaRow icon="location-outline" text={event.location} /> : null}
          {attendees > 0 ? (
            <MetaRow icon="people-outline" text={`${attendees} attendees`} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// expo-image with a Supabase resize + graceful fallback. We first try a small
// resized variant (fast); if the project has image transforms disabled and the
// render URL fails, we retry once with the original URL. memory-disk caching
// means a photo the gallery already loaded is instant on the card and vice
// versa.
function RemoteImage({
  url,
  width,
  style,
  contentFit = 'cover',
}: {
  url: string;
  width: number;
  style: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  const [useOriginal, setUseOriginal] = useState(false);
  const uri = useOriginal ? url : resizedImage(url, width);
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={150}
      onError={() => {
        if (!useOriginal) setUseOriginal(true);
      }}
    />
  );
}

// Full-screen swipeable viewer for an event's photos. Paging FlatList on a
// black backdrop, a close button, and a "2 / 4" counter — the mobile take on
// the website's lightbox.
function ImageGallery({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number;
  onClose: () => void;
}) {
  const { width, height } = Dimensions.get('window');
  const [current, setCurrent] = useState(index);
  const listRef = useRef<FlatList<string>>(null);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(item, i) => `${i}-${item}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) =>
            setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View style={{ width, height }} className="items-center justify-center">
              <RemoteImage
                url={item}
                width={1080}
                contentFit="contain"
                style={{ width, height }}
              />
            </View>
          )}
        />

        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
          <View className="flex-row items-center justify-between px-4 py-2">
            <View className="rounded-full bg-white/15 px-3 py-1">
              <Text className="text-xs font-semibold text-white">
                {current + 1} / {images.length}
              </Text>
            </View>
            <TouchableOpacity
              className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MetaRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={12} color="#a1a1aa" />
      <Text className="text-xs text-zinc-500">{text}</Text>
    </View>
  );
}

// -------------------------------------------------------------------- links

// type → icon + tint, mirroring the website's LinkTypeIcon.
function linkIcon(type?: string | null): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case 'repo':
      return { name: 'logo-github', color: '#e4e4e7' };
    case 'youtube':
      return { name: 'logo-youtube', color: '#f87171' };
    case 'linkedin':
      return { name: 'logo-linkedin', color: '#60a5fa' };
    case 'twitter':
      return { name: 'logo-twitter', color: '#e4e4e7' };
    case 'instagram':
      return { name: 'logo-instagram', color: '#f472b6' };
    case 'paper':
      return { name: 'document-text', color: '#c084fc' };
    case 'article':
      return { name: 'document-text', color: '#d4d4d8' };
    default:
      return { name: 'globe-outline', color: '#a1a1aa' };
  }
}

function LinksSection() {
  const { data, loading, refreshing, error, load, onRefresh } = useSection(
    () => getLinks().then((r) => r.groups ?? []),
    [] as LinkGroup[],
  );
  const [search, setSearch] = useState('');

  // Filter within each group by title/notes/label, then drop empty groups —
  // the same shape the website uses.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data
      .map((g) => ({
        ...g,
        links: g.links.filter((l) =>
          [l.title, l.notes, l.label].some(
            (f) => typeof f === 'string' && f.toLowerCase().includes(q),
          ),
        ),
      }))
      .filter((g) => g.links.length > 0);
  }, [data, search]);

  if (loading) return <Loading />;

  return (
    <FlatList
      data={filtered}
      keyExtractor={(group) => group.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
      ListHeaderComponent={
        <>
          <SectionHeader title="Exposure Links" subtitle="Every link shared in Exposure." />
          <View className="mb-5 flex-row items-center rounded-2xl border border-black/10 bg-white px-3.5">
            <Ionicons name="search" size={16} color="#a1a1aa" />
            <TextInput
              className="flex-1 py-3 pl-2.5 text-[15px] text-zinc-900"
              placeholder="Search links by title or description…"
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              autoCorrect={false}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
          {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        </>
      }
      ListEmptyComponent={
        error ? null : (
          <Empty message={search ? 'No links match your search.' : 'No links shared yet.'} />
        )
      }
      renderItem={({ item: group }) => (
        <View className="mb-6">
          <View className="mb-3 flex-row items-center gap-3">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              {shortDate(group.date_from)}
              {group.date_to ? ` — ${longDateShort(group.date_to)}` : ''}
            </Text>
            <View className="h-px flex-1 bg-black/10" />
            <Text className="text-[11px] text-zinc-400">
              {group.links.length} link{group.links.length === 1 ? '' : 's'}
            </Text>
          </View>
          {group.links.map((link, index) => (
            <LinkRow key={`${group.id}-${index}`} link={link} />
          ))}
        </View>
      )}
    />
  );
}

function LinkRow({ link }: { link: SharedLink }) {
  const icon = linkIcon(link.type);
  return (
    <TouchableOpacity
      className="mb-2 flex-row items-start gap-3 rounded-xl border border-black/5 bg-white px-4 py-3.5"
      activeOpacity={0.8}
      onPress={() => Linking.openURL(link.url).catch(() => {})}
    >
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
        <Ionicons name={icon.name} size={16} color="#52525b" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium leading-snug text-zinc-900">
          {link.title || link.label || link.url}
        </Text>
        {link.notes ? (
          <Text className="mt-0.5 text-xs leading-5 text-zinc-500" numberOfLines={2}>
            {link.notes}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-2">
        {link.label ? (
          <View className="rounded-full bg-zinc-100 px-2.5 py-1">
            <Text className="text-[10px] font-semibold text-zinc-600">{link.label}</Text>
          </View>
        ) : null}
        <Ionicons name="open-outline" size={14} color="#a1a1aa" />
      </View>
    </TouchableOpacity>
  );
}

// "MAY 27" (no year) for the range start, "JUL 16, 2026" for the end — matches
// the website's two-format range.
function shortDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function longDateShort(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --------------------------------------------------------------- newsletter

function NewsletterSection() {
  const { data, loading, refreshing, error, load, onRefresh } = useSection(
    () => getNewsletter().then((r) => r.posts ?? []),
    [] as NewsletterPost[],
  );

  if (loading) return <Loading />;

  // No dedicated subscribe URL — the website derives it from the newest post's
  // origin and hides the button when there are no posts.
  const subscribeUrl = subscribeUrlFrom(data);

  return (
    <FlatList
      data={data}
      keyExtractor={(post) => post.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
      ListHeaderComponent={
        <>
          <SectionHeader
            title="Overexposed"
            subtitle="Curated weekly digest of Exposure."
            badge={{ label: 'Newsletter', className: 'bg-blue-500/15' }}
            action={
              subscribeUrl ? (
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2.5"
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(subscribeUrl).catch(() => {})}
                >
                  <Ionicons name="mail-outline" size={14} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Subscribe</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
          {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        </>
      }
      ListEmptyComponent={error ? null : <Empty message="No posts yet." />}
      renderItem={({ item, index }) => {
        const latest = index === 0;
        return (
          <View
            className={`mb-3 rounded-2xl border p-5 ${
              latest ? 'border-brand-blue/30 bg-brand-blue/5' : 'border-black/5 bg-white'
            }`}
          >
            {latest ? (
              <View className="mb-3 self-start rounded-full bg-brand-blue px-2.5 py-0.5">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                  Latest
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="text-base font-bold text-zinc-900">{item.title}</Text>
                {item.publish_date != null ? (
                  <Text className="mt-1 text-xs text-zinc-400">
                    {longDate(newsletterMillis(item.publish_date))}
                  </Text>
                ) : null}
                {item.subtitle ? (
                  <Text className="mt-2 text-sm leading-5 text-zinc-600">{item.subtitle}</Text>
                ) : null}
              </View>
              {item.web_url ? (
                <TouchableOpacity
                  className="mt-0.5 flex-row items-center gap-1 rounded-lg bg-zinc-100 px-3 py-2"
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(item.web_url).catch(() => {})}
                >
                  <Text className="text-xs font-medium text-zinc-600">Read</Text>
                  <Ionicons name="chevron-forward" size={14} color="#52525b" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}

// Beehiiv publish_date is seconds; turn it into millis for Date. An ISO string
// passes through untouched.
function newsletterMillis(raw: number | string): number | string {
  return typeof raw === 'number' ? raw * 1000 : raw;
}

function subscribeUrlFrom(posts: NewsletterPost[]): string | null {
  const url = posts[0]?.web_url;
  if (!url) return null;
  try {
    return `${new URL(url).origin}/subscribe`;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ youtube

function YoutubeSection() {
  const { data, loading, refreshing, error, load, onRefresh } = useSection(
    () => getYoutube(),
    { longForm: [] as YoutubeVideo[], shorts: [] as YoutubeVideo[] },
  );

  if (loading) return <Loading />;

  const longForm = data.longForm ?? [];
  const shorts = data.shorts ?? [];
  const empty = longForm.length === 0 && shorts.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
      }
    >
      <SectionHeader
        title="YouTube"
        subtitle="Videos from Exposure YouTube channel."
        badge={{ label: 'Channel', className: 'bg-red-500/15' }}
        action={
          <TouchableOpacity
            className="flex-row items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5"
            activeOpacity={0.85}
            onPress={() => Linking.openURL(YOUTUBE_CHANNEL_URL).catch(() => {})}
          >
            <Ionicons name="logo-youtube" size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">Subscribe</Text>
          </TouchableOpacity>
        }
      />

      {error ? <ErrorNotice message={error} onRetry={load} /> : null}
      {empty && !error ? <Empty message="No videos yet." /> : null}

      {/* Long-form: one per row, 16:9. Shorts: two per row, 9:16 — the mobile
          reading of the website's 3-col / 5-col grids. */}
      {longForm.length > 0 ? (
        <View className="mb-2">
          {longForm.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </View>
      ) : null}

      {shorts.length > 0 ? (
        <View className="flex-row flex-wrap justify-between">
          {shorts.map((video) => (
            <VideoCard key={video.id} video={video} vertical />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

// Prefer the API's thumbnails; fall back to YouTube's derived URLs by id.
function thumbUrl(video: YoutubeVideo): string | null {
  if (video.thumbnail_urls?.[0]) return video.thumbnail_urls[0];
  const id = youtubeId(video.youtube_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1];
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

function ytDate(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function VideoCard({ video, vertical }: { video: YoutubeVideo; vertical?: boolean }) {
  const uri = thumbUrl(video);
  return (
    <TouchableOpacity
      className={`mb-3 overflow-hidden rounded-2xl border border-black/5 bg-white ${
        vertical ? 'w-[48%]' : ''
      }`}
      activeOpacity={0.85}
      onPress={() => Linking.openURL(video.youtube_url).catch(() => {})}
    >
      <View className="relative">
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', aspectRatio: vertical ? 9 / 16 : 16 / 9 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{ width: '100%', aspectRatio: vertical ? 9 / 16 : 16 / 9 }}
            className="items-center justify-center bg-zinc-200"
          >
            <Ionicons name="logo-youtube" size={28} color="#a1a1aa" />
          </View>
        )}
        {/* Play badge overlay, like the website. */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-red-600/90">
            <Ionicons name="play" size={20} color="#fff" />
          </View>
        </View>
      </View>
      <View className={vertical ? 'p-3' : 'p-4'}>
        <Text
          className={`font-semibold leading-snug text-zinc-900 ${vertical ? 'text-xs' : 'text-sm'}`}
          numberOfLines={2}
        >
          {video.title}
        </Text>
        <Text className={`mt-1 text-zinc-400 ${vertical ? 'text-[11px]' : 'text-xs'}`}>
          {ytDate(video.published_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
