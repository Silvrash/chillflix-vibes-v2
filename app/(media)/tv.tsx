import { getDiscoverTVShowsInfiniteQuery, getSearchTVSeriesInfiniteQuery, MediaType } from "@/api/tmdb";
import { ANIME_FILTERS } from "@/api/tmdb-client";
import Content from "@/components/home/TabContent";
import { Config } from "@/constants/config";
import useDynamicColumns from "@/hooks/useDynamicColumns";
import { useInfiniteQuery } from "@tanstack/react-query";
import React from "react";
import { StyleSheet } from "react-native";

const TvShows = () => {
  const numColumns = useDynamicColumns();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentPreset, setCurrentPreset] = React.useState(Config.presets.tvPresets[0].name);

  const presetFilter = Config.presets.tvPresets.find((preset) => preset.name === currentPreset);

  const tvShows = useInfiniteQuery(
    getDiscoverTVShowsInfiniteQuery({
      enabled: !searchQuery,
      variables: {
        include_adult: false,
        page: 1,
        without_genres: ANIME_FILTERS.with_genres,
        ...presetFilter?.filters,
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    }),
  );

  const search = useInfiniteQuery(
    getSearchTVSeriesInfiniteQuery({
      enabled: !!searchQuery,
      variables: { page: 1, query: searchQuery, include_adult: false },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    }),
  );

  return (
    <Content
      query={!!searchQuery ? search : tvShows}
      currentPreset={currentPreset}
      setCurrentPreset={setCurrentPreset}
      presets={Config.presets.tvPresets}
      numColumns={numColumns}
      mediaType={MediaType.tv}
      onSearch={setSearchQuery}
    />
  );
};

const styles = StyleSheet.create({});

export default TvShows;
