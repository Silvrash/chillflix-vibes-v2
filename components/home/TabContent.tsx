import { DiscoverMovieResponse, DiscoverTVResponse, MediaType, Movie, TVShow } from "@/api/tmdb";
import MediaItem, { MEDIA_ITEM_HEIGHT } from "@/components/home/MediaItem";
import ListView from "@/components/ListView";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import Trending from "@/components/tending/Trending";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { Config } from "@/constants/config";
import { Ionicons } from "@expo/vector-icons";
import { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { AxiosError } from "axios";
import React, { Dispatch, memo, useEffect, useMemo, useRef } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { ThemedViewIf } from "../ConditionRender";

interface ContentProps<Response extends DiscoverMovieResponse | DiscoverTVResponse> {
  query: UseInfiniteQueryResult<InfiniteData<Response, unknown>, AxiosError<unknown, any>>;
  numColumns?: number;
  mediaType: MediaType;
  animeOnly?: boolean;
  presets: typeof Config.presets.moviePresets | typeof Config.presets.tvPresets;
  currentPreset: string;
  setCurrentPreset: Dispatch<<S>(prevState: S) => S>;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
}

function Content<Response extends DiscoverMovieResponse | DiscoverTVResponse>({
  query,
  numColumns = 3,
  mediaType,
  animeOnly,
  presets,
  currentPreset,
  setCurrentPreset,
  onSearch,
  onFilter,
}: ContentProps<Response>) {
  const pageSize = numColumns * 6;
  const dimensions = useWindowDimensions();
  const listView = useRef<FlatList>(null);
  const [presetOpen, setPresetOpen] = React.useState(false);
  const data = useMemo(() => query.data?.pages.flatMap((page) => page.results as (Movie | TVShow)[]), [query.data]);

  useEffect(() => {
    if (query.isFetchingNextPage || query.isLoading) return;

    const totalPageSize = (query.data?.pages.length ?? 0) * 20;

    if (totalPageSize <= pageSize) {
      query.fetchNextPage();
    }
  }, [query.isFetching]);

  return (
    <ParallaxScrollView
      headerImage={<Trending mediaType={mediaType} animeOnly={animeOnly} />}
      searchEnabled
      filterEnabled
      searchPlaceholder={`Search ${mediaType === MediaType.movie ? "Movies" : animeOnly ? "Anime" : "TV Shows"}`}
      onSearch={onSearch}
      onFilter={onFilter}
      header={
        <ThemedView style={styles.titleContainer}>
          <DropDownPicker
            open={presetOpen}
            value={currentPreset}
            items={presets.map((preset) => ({
              label: preset.name,
              value: preset.name,
            }))}
            setOpen={setPresetOpen}
            setValue={setCurrentPreset}
            style={styles.dropdown}
            textStyle={styles.dropdownSelectedText}
            searchable
            listMode="SCROLLVIEW"
            scrollViewProps={{ nestedScrollEnabled: true }}
            maxHeight={dimensions.height / 3}
            searchPlaceholder="Find a preset"
            selectedItemLabelStyle={styles.dropdownSelectedText}
            listItemLabelStyle={styles.dropdownText}
            listMessageTextStyle={styles.dropdownText}
            dropDownContainerStyle={styles.dropDownContainer}
            searchPlaceholderTextColor={Colors.dark.text}
            searchTextInputStyle={styles.dropdownSearchInput}
            arrowIconStyle={{ tintColor: Colors.dark.text } as any}
            tickIconStyle={{ tintColor: Colors.dark.text } as any}
            showTickIcon
          />
        </ThemedView>
      }
    >
      <ThemedView style={styles.mediaContainer}>
        <ListView
          key={numColumns}
          ref={listView}
          nestedScrollEnabled
          numColumns={numColumns}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          data={data}
          onEndReached={() => query.fetchNextPage()}
          columnWrapperStyle={{ gap: 8 }}
          isLoading={query.isFetching || query.isFetchingNextPage}
          onEndReachedThreshold={0.5}
          getItemLayout={(_, index) => ({
            length: MEDIA_ITEM_HEIGHT,
            offset: MEDIA_ITEM_HEIGHT * index,
            index,
          })}
          refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
          renderItem={({ item }) => <MediaItem item={item} anime={animeOnly} />}
        />

        <ThemedViewIf
          renderIf={!data?.length && !(query.isFetching || query.isFetchingNextPage)}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            aspectRatio: Platform.select({ web: 16 / 3, default: 1 }),
          }}
        >
          <Ionicons name="search" size={64} color={Colors.dark.icon} />
          <ThemedText>No results found</ThemedText>
        </ThemedViewIf>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mediaContainer: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  dropdown: {
    backgroundColor: Colors.dark.background,
    borderWidth: 0,
    alignSelf: "flex-start",
    zIndex: 99,
  },
  dropdownText: {
    color: Colors.dark.text,
    fontWeight: "400",
  },
  dropDownContainer: {
    backgroundColor: "#0b121e",
    zIndex: 999,
  },
  dropdownSelectedText: {
    fontWeight: "bold",
    color: Colors.dark.text,
  },
  dropdownSearchInput: {
    color: Colors.dark.text,
    borderWidth: 0,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.text,
    fontWeight: "400",
  },
});
export default memo(Content);
