import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { FlatListProps, Platform, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  withTiming,
} from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { goBack } from "@/constants/utilities";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import debounce from "debounce";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConditionRenderComponent, ThemedViewIf } from "./ConditionRender";

interface ParallaxScrollViewProps<ItemT> extends Omit<FlatListProps<unknown>, "renderItem" | "data"> {
  headerImage: ReactElement;
  header: ReactElement;
  headerBackgroundColor?: { dark: string; light: string };
  children?: ReactNode | undefined;
  backEnabled?: boolean;
  searchEnabled?: boolean;
  filterEnabled?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onStartSearch?: () => void;
  onFilter?: () => void;
}

export default function ParallaxScrollView<ItemT>({
  headerImage,
  header,
  headerBackgroundColor,
  children,
  backEnabled,
  searchEnabled,
  searchPlaceholder,
  onSearch,
  onStartSearch,
  filterEnabled,
  onFilter,
  ...flatListProps
}: ParallaxScrollViewProps<ItemT>) {
  const dimensions = useWindowDimensions();
  const deviceHeight = dimensions.height;
  const headerRef = useAnimatedRef<Animated.View>();
  const [headerHeight, setHeaderHeight] = useState(0);

  const HEADER_HEIGHT = useMemo(() => deviceHeight * Platform.select({ native: 0.4, default: 0.5 }), [deviceHeight]);

  const backgroundColor = useThemeColor("background");
  const scrollRef = useAnimatedRef<Animated.FlatList<ItemT>>();
  const scrollOffset = useScrollViewOffset(scrollRef as any);
  const searchInput = useAnimatedRef<TextInput>();
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const indexBeforeSearch = useRef<number>(0);
  const currentViewableIndex = useRef<number>(0);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      height: isSearching ? withTiming(0) : withTiming(HEADER_HEIGHT),
      // display: !isSearching ? "flex" : "none",
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75],
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  const stickyHeaderStyle = useAnimatedStyle(() => {
    return {
      paddingTop: (!isSearching && scrollOffset.value < HEADER_HEIGHT ? 0 : safeAreaInsets.top) + 16,
      paddingBottom: 16,
      backgroundColor,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      top: -0.1,
      zIndex: 100,
    };
  });

  const backButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: scrollOffset.value < HEADER_HEIGHT ? 0 : 1,
      display: scrollOffset.value < HEADER_HEIGHT ? "none" : "flex",
    };
  });

  const searchButtonStyle = useAnimatedStyle(() => {
    const height = scrollOffset.value < HEADER_HEIGHT ? 0 : 40;
    return {
      height: withTiming(isSearching ? 40 : height),
      display: isSearching ? "flex" : height > 0 ? "flex" : "none",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 1,
      overflow: "hidden",
    };
  });

  const renderHeader = useCallback(() => {
    return (
      <Animated.View
        style={[styles.header, headerAnimatedStyle]}
        onLayout={(event) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      >
        {headerImage}
        {!!backEnabled && (
          <TouchableOpacity
            style={{ position: "absolute", left: 16, top: safeAreaInsets.top + 16 }}
            onPress={() => goBack(router)}
          >
            <Ionicons name="arrow-back-sharp" size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        )}
        <View
          style={{
            flexDirection: "row",
            gap: 20,
            position: "absolute",
            top: safeAreaInsets.top + Platform.select({ web: 16, default: 0 }),
            right: 16,
          }}
        >
          <ConditionRenderComponent renderIf={!!filterEnabled}>
            <TouchableOpacity onPress={onFilter} hitSlop={20}>
              <Ionicons name="filter-outline" size={32} color={"#23406eef"} />
            </TouchableOpacity>
          </ConditionRenderComponent>

          <ConditionRenderComponent renderIf={!!searchEnabled}>
            <TouchableOpacity onPress={startSearch} hitSlop={20}>
              <Ionicons name="search-outline" size={32} color={"#23406eef"} />
            </TouchableOpacity>
          </ConditionRenderComponent>
        </View>
      </Animated.View>
    );
  }, []);

  const onViewableItemsChanged = useRef<FlatListProps<unknown>["onViewableItemsChanged"]>(({ viewableItems }) => {
    if (viewableItems.length > 0 && typeof viewableItems[0].index === "number") {
      currentViewableIndex.current = viewableItems[0].index;
    }
  });

  useLayoutEffect(() => {
    if (!isSearching) return;
    onStartSearch?.();
  }, [isSearching]);

  function startSearch() {
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    indexBeforeSearch.current = currentViewableIndex.current;
    setIsSearching(true);
  }

  function stopSearch() {
    setIsSearching(false);
    onSearch?.("");
    scrollRef.current?.scrollToIndex({ index: indexBeforeSearch.current, animated: true });
  }

  return (
    <ThemedView style={styles.container}>
      <Animated.FlatList
        ref={scrollRef}
        data={useRef([1]).current}
        {...flatListProps}
        stickyHeaderIndices={useRef([1]).current}
        ListHeaderComponent={renderHeader}
        onEndReachedThreshold={0.5}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged.current}
        ListFooterComponent={<ThemedView style={styles.content}>{children}</ThemedView>}
        renderItem={() => {
          return (
            <Animated.View ref={headerRef} style={[styles.content, stickyHeaderStyle]}>
              {!!backEnabled && (
                <Animated.View style={backButtonStyle}>
                  <TouchableOpacity onPress={() => goBack(router)}>
                    <Ionicons name="arrow-back-sharp" size={24} color={Colors.dark.text} />
                  </TouchableOpacity>
                </Animated.View>
              )}

              <ConditionRenderComponent renderIf={!isSearching}>
                <View style={{ flex: 1, flexGrow: 1 }}>{header}</View>
              </ConditionRenderComponent>

              <ThemedViewIf renderIf={isSearching} style={{ flex: 1, flexGrow: 1 }}>
                <TextInput
                  ref={searchInput}
                  style={styles.searchInput}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={Colors.dark.tabIconDefault}
                  autoFocus
                  onChangeText={onSearch && debounce(onSearch, 500)}
                  returnKeyType="search"
                />
              </ThemedViewIf>

              <ThemedView style={{ gap: 24, flexDirection: "row" }}>
                <ConditionRenderComponent renderIf={!!searchEnabled && !!filterEnabled}>
                  <Animated.View style={searchButtonStyle}>
                    <TouchableOpacity>
                      <Ionicons name={"filter-outline"} size={24} color={"#bfcfe84f"} />
                    </TouchableOpacity>
                  </Animated.View>
                </ConditionRenderComponent>

                <ConditionRenderComponent renderIf={!!searchEnabled}>
                  <Animated.View style={searchButtonStyle}>
                    <TouchableOpacity onPress={!isSearching ? startSearch : stopSearch}>
                      <Ionicons name={isSearching ? "close-outline" : "search-outline"} size={24} color={"#bfcfe84f"} />
                    </TouchableOpacity>
                  </Animated.View>
                </ConditionRenderComponent>
              </ThemedView>
            </Animated.View>
          );
        }}
      ></Animated.FlatList>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    overflow: "hidden",
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 16,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderColor: "#abb9d0ac",
    flex: 1,
    height: 40,
    paddingVertical: Platform.select({ web: 20, default: 0 }),
    color: Colors.dark.text,
    width: "100%",
    // paddingHorizontal: 16,
  },
});
