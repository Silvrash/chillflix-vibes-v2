import { getMovieDetailsQuery, getSeasonDetailsQuery, getTVDetailsQuery, MediaType } from "@/api/tmdb";
import { ConditionRenderComponent, ThemedTextIf, ThemedViewIf } from "@/components/ConditionRender";
import PlayerView from "@/components/PlayerView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { goBack } from "@/constants/utilities";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Player = () => {
  const { id, type } = useLocalSearchParams<{ id: string; type: MediaType }>();
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [seasonValue, setSeasonValue] = useState(1);
  const [episodeValue, setEpisodeValue] = useState(1);
  const seasonDetails = useQuery(
    getSeasonDetailsQuery({
      enabled: type === MediaType.tv,
      variables: {
        season_number: 1,
        tv_id: parseInt(id),
      },
    })
  );

  const movie = useQuery(getMovieDetailsQuery({ enabled: type === MediaType.movie, variables: { movie_id: parseInt(id) } }));
  const tv = useQuery(getTVDetailsQuery({ enabled: type === MediaType.tv, variables: { tv_id: parseInt(id) } }));

  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();

  if (!id || !type) return <Redirect href="/(media)/movies" />;

  function getVideoUrl() {
    switch (type) {
      case MediaType.movie:
        return `https://vidsrc.icu/embed/movie/${id}`;
      case MediaType.tv:
        return `https://vidsrc.icu/embed/tv/${id}/${seasonValue}/${episodeValue}`;
      default:
        return "";
    }
  }

  useLayoutEffect(() => {
    AsyncStorage.getItem(`${type}-${id}-season`).then((value) => {
      if (value) setSeasonValue(parseInt(value));
    });

    AsyncStorage.getItem(`${type}-${id}-episode`).then((value) => {
      if (value) setEpisodeValue(parseInt(value));
    });

  }, []);

  useEffect(() => {
    AsyncStorage.setItem(`${type}-${id}-season`, seasonValue.toString());
    AsyncStorage.setItem(`${type}-${id}-episode`, episodeValue.toString());
  }, [episodeValue, seasonValue]);

  const releaseYear = movie.data?.release_date?.split("-")[0] ?? tv.data?.first_air_date?.split("-")[0];
  const totalSeasons = tv.data?.number_of_seasons ?? 0;
  const episode = seasonDetails.data?.episodes?.find((episode) => episode.episode_number === episodeValue);

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top + Platform.select({ web: 24, default: 0 }) }]}>
      <StatusBar style="light" />

      <ThemedView
        style={{
          flexDirection: "row",
          gap: 24,
          width: "100%",
          alignItems: "center",
          paddingHorizontal: Platform.select({ web: 0, default: 16 }),
        }}
      >
        <TouchableOpacity onPress={() => goBack(router)}>
          <Ionicons name="arrow-back-sharp" size={24} color={Colors.dark.text} />
        </TouchableOpacity>

        <ThemedTextIf type="title" renderIf={type === MediaType.movie}>
          {movie.data?.title} ({releaseYear})
        </ThemedTextIf>

        <ThemedTextIf renderIf={type === MediaType.tv} type="title">
          {tv.data?.name} ({releaseYear}) - S{String(seasonValue).padStart(2, "0")} E{String(episodeValue).padStart(2, "0")}
        </ThemedTextIf>
      </ThemedView>

      <ThemedText style={{ paddingHorizontal: Platform.select({ web: 0, default: 16 }), paddingTop: 16 + safeAreaInsets.bottom }}>
        {movie.data?.overview ?? tv.data?.overview}
      </ThemedText>

      <View style={{ justifyContent: "center", alignItems: "center", flex: 1 }}>
        <PlayerView link={getVideoUrl()} />
      </View>
      <ThemedViewIf renderIf={type === MediaType.movie} style={{ height: "5%" }} />

      <ThemedTextIf renderIf={!!episode?.overview} style={{ paddingHorizontal: Platform.select({ web: 0, default: 16 }) }}>
        <ThemedText type="subtitle">
          S{String(seasonValue).padStart(2, "0")} E{String(episodeValue).padStart(2, "0")} - {episode?.name}
        </ThemedText>
      </ThemedTextIf>

      <ThemedTextIf
        renderIf={!!episode?.overview}
        style={{ paddingHorizontal: Platform.select({ web: 0, default: 16 }), marginVertical: 16 }}
      >
        <ThemedText>{episode?.overview}</ThemedText>
      </ThemedTextIf>

      <ConditionRenderComponent renderIf={type === MediaType.tv}>
        <ThemedView
          style={{
            width: "100%",
            paddingBottom: safeAreaInsets.bottom,
            paddingHorizontal: Platform.select({ web: 0, default: 16 }),
          }}
        >
          <View style={{ flexDirection: "row", width: "100%" }}>
            <View style={{ width: "50%" }}>
              <DropDownPicker
                open={seasonOpen}
                value={seasonValue}
                items={Array.from({ length: totalSeasons }, (_, i) => ({
                  label: `Season ${i + 1}`,
                  value: i + 1,
                }))}
                setOpen={setSeasonOpen}
                setValue={setSeasonValue}
                style={styles.dropdown}
                textStyle={styles.dropdownText}
                searchable
                searchPlaceholder="Search for a season"
                dropDownContainerStyle={styles.dropDownContainer}
                searchPlaceholderTextColor={Colors.dark.text}
                searchTextInputStyle={styles.dropdownSearchInput}
                arrowIconStyle={{ tintColor: Colors.dark.text } as any}
                tickIconStyle={{ tintColor: Colors.dark.text } as any}
                showTickIcon
              />
            </View>

            <View style={{ width: "50%" }}>
              {!!seasonDetails.data?.episodes && (
                <DropDownPicker
                  open={episodesOpen}
                  value={episodeValue}
                  items={seasonDetails.data?.episodes?.map((episode) => ({
                    label: `Episode ${episode.episode_number}`,
                    value: episode.episode_number,
                  }))}
                  scrollViewProps={{ keyboardShouldPersistTaps: "always", automaticallyAdjustKeyboardInsets: true }}
                  setOpen={setEpisodesOpen}
                  setValue={setEpisodeValue}
                  style={styles.dropdown}
                  textStyle={styles.dropdownText}
                  searchable
                  searchPlaceholder="Search for an episode"
                  searchPlaceholderTextColor={Colors.dark.text}
                  searchTextInputStyle={styles.dropdownSearchInput}
                  dropDownContainerStyle={styles.dropDownContainer}
                  arrowIconStyle={{ tintColor: Colors.dark.text } as any}
                  tickIconStyle={{ tintColor: Colors.dark.text } as any}
                  showTickIcon
                />
              )}
            </View>
          </View>
        </ThemedView>
      </ConditionRenderComponent>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: Colors.dark.background,
    borderWidth: 0,
    alignSelf: "flex-start",
    zIndex: 99,
  },
  dropdownText: {
    color: Colors.dark.text,
  },
  dropDownContainer: {
    backgroundColor: "#0b121e",
    zIndex: 999,
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

export default Player;
