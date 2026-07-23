// The two button shapes used across the app: a filled brand-blue pill for
// the main action on a screen, and an outlined one for everything else.
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { BRAND_CREAM } from '../lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  // Swaps the label for a spinner. Separate from `disabled` because a button
  // can be disabled for other reasons (empty form) without being in flight.
  busy?: boolean;
};

export function PrimaryButton({ label, onPress, disabled, busy }: Props) {
  return (
    <TouchableOpacity
      className={`mt-4 items-center rounded-full bg-brand-blue py-4 ${
        disabled || busy ? 'opacity-50' : ''
      }`}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || busy}
    >
      {busy ? (
        <ActivityIndicator color={BRAND_CREAM} />
      ) : (
        <Text className="text-[15px] font-bold text-brand-cream">{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, disabled, busy }: Props) {
  return (
    <TouchableOpacity
      className={`mt-3 items-center rounded-full border border-hairline py-3.5 ${
        disabled || busy ? 'opacity-50' : ''
      }`}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || busy}
    >
      <Text className="text-[14px] font-semibold text-muted">{label}</Text>
    </TouchableOpacity>
  );
}
