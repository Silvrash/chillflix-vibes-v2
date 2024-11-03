import { getTrendingMoviesQuery, getTrendingTVShowsQuery, MediaType, TimeWindow } from "@/api/tmdb";
import { ANIME_FILTERS } from "@/api/tmdb-client";
import { useQuery } from "@tanstack/react-query";
import React, { memo, useMemo } from "react";
import { ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConditionRenderComponent } from "../ConditionRender";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import CarouselView from "./Carousel";

const seed = Math.random() - 0.5;

interface TrendingProps {
  mediaType: MediaType;
  animeOnly?: boolean;
}

const Trending = ({ mediaType, animeOnly }: TrendingProps) => {
  const safeAreaInset = useSafeAreaInsets();
  const fn = mediaType === MediaType.movie ? getTrendingMoviesQuery : getTrendingTVShowsQuery;
  const results = useQuery(fn({ variables: { time_window: TimeWindow.day } }));

  const data = useMemo(() => {
    return (
      results.data?.results.filter((item) => {
        const genres = new Set(item.genre_ids);
        const isNotAnime = ANIME_FILTERS.with_genres
          .split(",")
          .map(Number)
          .every((genre) => !genres.has(genre));

        if (animeOnly) return !isNotAnime;

        if (mediaType === MediaType.movie) return item.media_type === "movie" && isNotAnime;
        return item.media_type === "tv" && isNotAnime;
      }) ?? []
    ).sort(() => seed);
  }, [results.data]);

  const isError = results.isError;
  const isLoading = results.isLoading;
  const isSuccess = results.isSuccess;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1, justifyContent: "center", position: "relative" }}>
        <ConditionRenderComponent renderIf={isLoading}>
          <ActivityIndicator size={"large"} />
        </ConditionRenderComponent>

        <ConditionRenderComponent renderIf={isError}>
          <ThemedText>Error</ThemedText>
        </ConditionRenderComponent>

        <ConditionRenderComponent renderIf={isSuccess}>
          <CarouselView data={data} animeOnly={animeOnly} />
        </ConditionRenderComponent>
      </ThemedView>
    </ThemedView>
  );
};

export default memo(Trending);
