import { getDiscoverMoviesInfiniteQuery, getSearchMoviesInfiniteQuery, MediaType } from "@/api/tmdb";
import Content from "@/components/home/TabContent";
import { Config } from "@/constants/config";
import useDynamicColumns from "@/hooks/useDynamicColumns";
import { useInfiniteQuery } from "@tanstack/react-query";
import React from "react";
import { StyleSheet } from "react-native";

const Movies = () => {
  const numColumns = useDynamicColumns();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentPreset, setCurrentPreset] = React.useState(Config.presets.moviePresets[0].name);
  const presetFilter = Config.presets.moviePresets.find((preset) => preset.name === currentPreset);

  const movies = useInfiniteQuery(
    getDiscoverMoviesInfiniteQuery({
      enabled: !searchQuery,
      variables: {
        include_adult: false,
        page: 1,
        ...presetFilter?.filters,
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    })
  );

  const search = useInfiniteQuery(
    getSearchMoviesInfiniteQuery({
      enabled: !!searchQuery,
      variables: { page: 1, query: searchQuery, include_adult: false },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.page + 1,
      getPreviousPageParam: (firstPage) => (firstPage.page <= 1 ? undefined : firstPage.page - 1),
    })
  );

  return (
    <Content
      query={!!searchQuery ? search : movies}
      currentPreset={currentPreset}
      setCurrentPreset={setCurrentPreset}
      presets={Config.presets.moviePresets}
      numColumns={numColumns}
      mediaType={MediaType.movie}
      onSearch={setSearchQuery}
    />
  );
};

const styles = StyleSheet.create({});

export default Movies;
