// Member photo, or their initials on a blue circle when there isn't one.
// Used by the directory, job board, match and profile screens.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { initialsOf } from '../lib/format';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
};

export default function Avatar({ uri, name, size = 48 }: Props) {
  // Width/height/borderRadius are dynamic, so they stay inline styles —
  // NativeWind classes can't take a runtime number.
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={box}
        contentFit="cover"
        // expo-image caches to disk, so scrolling the directory a second
        // time doesn't re-download every photo.
        cachePolicy="memory-disk"
        transition={150}
      />
    );
  }

  return (
    <View className="items-center justify-center bg-brand-blue" style={box}>
      <Text
        className="font-bold text-brand-cream"
        style={{ fontSize: Math.round(size * 0.36) }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}
