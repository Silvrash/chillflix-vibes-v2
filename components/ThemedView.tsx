import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  safeArea?: boolean;
  animated?: boolean;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  safeArea,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor("background");
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View
      style={[{ backgroundColor, paddingTop: safeArea ? safeAreaInsets.top : undefined }, style]}
      {...otherProps}
    />
  );
}
