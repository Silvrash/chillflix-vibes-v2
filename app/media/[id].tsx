import { MediaType, Movie, TVShow } from "@/api/tmdb";
import { getTMDBImageUrl } from "@/api/tmdb-client";
import { ConditionRenderComponent } from "@/components/ConditionRender";
import MediaItem from "@/components/home/MediaItem";
import ListView from "@/components/ListView";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { goBack, normalizeRating } from "@/constants/utilities";
import { useMediaTypeQueries } from "@/hooks/useMediaTypeQueries";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEDIA_ITEM_HEIGHT = 100;

const Detail = () => {
  const { id, type, anime } = useLocalSearchParams<{ id: string; type: MediaType; anime?: string }>();
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();

  const { query, recommendedQuery, similarQuery } = useMediaTypeQueries(parseInt(id), type);

  if (query.isLoading || !query.data) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" />
        <TouchableOpacity onPress={() => goBack(router)} style={{ position: "absolute", left: 16, top: safeAreaInsets.top + 16 }}>
          <Ionicons name="arrow-back-sharp" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const title = "title" in query.data ? query.data?.title : query.data?.name;
  const releaseDate = "release_date" in query.data ? query.data?.release_date : query.data?.first_air_date;
  const runtime = "runtime" in query.data ? query.data?.runtime : query.data?.episode_run_time[0];
  const runtimeText = "runtime" in query.data ? "Runtime" : "Episode Runtime";
  const totalSeasons = "number_of_seasons" in query.data ? query.data?.number_of_seasons : null;
  const totalEpisodes = "number_of_episodes" in query.data ? query.data?.number_of_episodes : null;
  const recommended = recommendedQuery.data?.pages.flatMap((page) => page.results as (Movie | TVShow)[]);
  const similar = similarQuery.data?.pages.flatMap((page) => page.results as (Movie | TVShow)[]);

  return (
    <ParallaxScrollView
      contentContainerStyle={{ paddingBottom: 250 }}
      backEnabled
      headerImage={
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Image source={getTMDBImageUrl(query.data.backdrop_path, "w780")} style={StyleSheet.absoluteFill} contentFit="cover" />

          <TouchableOpacity
            onPress={() => router.push(`/player?id=${id}&type=${type}&anime=${anime}`)}
            hitSlop={20}
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(0,0,0,0.2)",
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Ionicons name="play-circle-sharp" size={48} color="#3f83f8" />
          </TouchableOpacity>
        </View>
      }
      header={
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">{title}</ThemedText>
        </ThemedView>
      }
    >
      <ThemedText>{query.data.overview}</ThemedText>
      <View style={{ flexDirection: "column", alignSelf: "flex-start" }}>
        <ThemedText>Released On: {releaseDate}</ThemedText>
        <ThemedText>
          {runtimeText}: {runtime} min
        </ThemedText>
        <ThemedText style={{ alignItems: "center", justifyContent: "center", textAlignVertical: "center" }}>
          Rating:{" "}
          <Ionicons
            name={query.data.vote_average >= 7.5 ? "star" : query.data.vote_average >= 5 ? "star-half" : "star-outline"}
            size={11}
            color="#fbbf24"
          />
          {normalizeRating(query.data.vote_average)}
        </ThemedText>
        <ThemedText>Seasons: {totalSeasons}</ThemedText>
        <ThemedText>Episodes: {totalEpisodes}</ThemedText>
      </View>

      <ConditionRenderComponent renderIf={!!query.data.credits?.cast.length}>
        <ThemedView style={styles.mediaContainer}>
          <ThemedText type="subtitle">Cast</ThemedText>
          <ListView
            contentContainerStyle={{ gap: 16 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            data={query.data.credits?.cast}
            renderItem={({ item }) => (
              <View style={{ width: MEDIA_ITEM_HEIGHT }}>
                <MediaItem item={item} />
              </View>
            )}
          />
        </ThemedView>
      </ConditionRenderComponent>

      <ConditionRenderComponent renderIf={!!recommended?.length}>
        <ThemedView style={styles.mediaContainer}>
          <ThemedText type="subtitle">Recommended</ThemedText>
          <ListView
            contentContainerStyle={{ gap: 16 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            data={recommended}
            onEndReached={() => recommendedQuery.fetchNextPage()}
            getItemLayout={(_, index) => ({
              length: MEDIA_ITEM_HEIGHT,
              offset: MEDIA_ITEM_HEIGHT * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={{ width: MEDIA_ITEM_HEIGHT }}>
                <MediaItem item={item} />
              </View>
            )}
          />
        </ThemedView>
      </ConditionRenderComponent>

      <ConditionRenderComponent renderIf={!!similar?.length}>
        <ThemedView style={styles.mediaContainer}>
          <ThemedText type="subtitle">Similar</ThemedText>
          <ListView
            contentContainerStyle={{ gap: 16 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            data={similar}
            onEndReached={() => similarQuery.fetchNextPage()}
            getItemLayout={(_, index) => ({
              length: MEDIA_ITEM_HEIGHT,
              offset: MEDIA_ITEM_HEIGHT * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={{ width: MEDIA_ITEM_HEIGHT }}>
                <MediaItem item={item} />
              </View>
            )}
          />
        </ThemedView>
      </ConditionRenderComponent>

      <ConditionRenderComponent renderIf={!!query.data.credits?.crew.length}>
        <ThemedView style={styles.mediaContainer}>
          <ThemedText type="subtitle">Crew</ThemedText>
          <ListView
            contentContainerStyle={{ gap: 16 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            data={query.data.credits?.crew}
            renderItem={({ item }) => (
              <View style={{ width: MEDIA_ITEM_HEIGHT }}>
                <MediaItem item={item} />
              </View>
            )}
          />
        </ThemedView>
      </ConditionRenderComponent>
    </ParallaxScrollView>
  );
};

const styles = StyleSheet.create({
  titleContainer: {},
  mediaContainer: {
    marginTop: 16,
    gap: 8,
  },
});

export default Detail;
