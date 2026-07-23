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
// theme: a light wash on cream, a dark translucent red on black.
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="mx-3 mb-2 mt-2 rounded-xl bg-red-50 px-4 py-3 dark:bg-red-500/10">
      <Text className="text-sm text-red-700 dark:text-red-300">{message}</Text>
      {onRetry ? (
        <TouchableOpacity className="mt-2" onPress={onRetry} activeOpacity={0.7}>
          <Text className="text-sm font-semibold text-red-700 dark:text-red-300">Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Neutral, non-alarming banner — for expected states like a read-only test
// account, where a red ErrorNotice would wrongly read as a failure.
export function InfoNotice({ message }: { message: string }) {
  return (
    <View className="mb-3 rounded-xl border border-hairline bg-chip px-4 py-3">
      <Text className="text-[13px] text-muted">{message}</Text>
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
