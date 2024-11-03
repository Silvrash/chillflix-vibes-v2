/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */


import { Colors } from '@/constants/Colors';

export function useThemeColor(
  colorName: keyof typeof Colors.dark
) {

  return Colors['dark'][colorName];
}
