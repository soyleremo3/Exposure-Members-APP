// The three states every data screen needs: loading, error, nothing here.
// Ten screens repeating these by hand is how they drift apart, so they live
// in one file. Nothing clever — just consistent spacing and color.
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '../lib/theme';

export function Loading() {
  const c = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color={c.accentLink} />
    </View>
  );
}

// Inline error strip. `onRetry` is optional — some errors (a 409 on a form)
// aren't worth retrying, they just need to be read. The red tint flips per
// theme: a light wash on cream, a dark translucent red on black. Driven by
// `isDark` rather than a `dark:` variant — this app doesn't toggle NativeWind's
// own class-based dark mode (see lib/theme.tsx), so `dark:` classes never fire.
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useThemeColors();
  const box = c.isDark ? 'bg-red-500/10' : 'bg-red-50';
  const text = c.isDark ? 'text-red-300' : 'text-red-700';
  return (
    <View className={`mx-3 mb-2 mt-2 rounded-xl px-4 py-3 ${box}`}>
      <Text className={`text-sm ${text}`}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity className="mt-2" onPress={onRetry} activeOpacity={0.7}>
          <Text className={`text-sm font-semibold ${text}`}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View className="items-center px-8 pt-16">
      <Text className="text-center text-[15px] text-faint">{message}</Text>
    </View>
  );
}
