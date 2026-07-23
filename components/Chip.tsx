// Small rounded label: member types, job tags, status badges.
import { Text, View } from 'react-native';

type Props = {
  label: string;
  // "solid" for status badges that should stand out (Closed, Applied),
  // "soft" for the many neutral tags on a card.
  tone?: 'soft' | 'solid' | 'warn';
};

const TONES = {
  soft: { box: 'bg-brand-blue/10', text: 'text-brand-blue' },
  solid: { box: 'bg-brand-blue', text: 'text-brand-cream' },
  warn: { box: 'bg-amber-100', text: 'text-amber-800' },
} as const;

export default function Chip({ label, tone = 'soft' }: Props) {
  const style = TONES[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{label}</Text>
    </View>
  );
}
