// The three states every data screen needs: loading, error, nothing here.
// Ten screens repeating these by hand is how they drift apart, so they live
// in one file. Nothing clever — just consistent spacing and color.
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { BRAND_BLUE } from '../lib/theme';

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-cream">
      <ActivityIndicator size="large" color={BRAND_BLUE} />
    </View>
  );
}

// Inline error strip. `onRetry` is optional — some errors (a 409 on a form)
// aren't worth retrying, they just need to be read.
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="mx-3 mb-2 mt-2 rounded-xl bg-red-50 px-4 py-3">
      <Text className="text-sm text-red-700">{message}</Text>
      {onRetry ? (
        <TouchableOpacity className="mt-2" onPress={onRetry} activeOpacity={0.7}>
          <Text className="text-sm font-semibold text-red-700">Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Neutral, non-alarming banner — for expected states like a read-only test
// account, where a red ErrorNotice would wrongly read as a failure.
export function InfoNotice({ message }: { message: string }) {
  return (
    <View className="mb-3 rounded-xl border border-black/5 bg-zinc-100 px-4 py-3">
      <Text className="text-[13px] text-zinc-600">{message}</Text>
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View className="items-center px-8 pt-16">
      <Text className="text-center text-[15px] text-zinc-500">{message}</Text>
    </View>
  );
}
