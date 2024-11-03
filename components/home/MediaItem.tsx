import { Cast, Crew, Movie, TVShow } from "@/api/tmdb";
import { getTMDBImageUrl } from "@/api/tmdb-client";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { ConditionRenderComponent } from "../ConditionRender";
import { ThemedText } from "../ThemedText";
import MediaImage from "./MediaImage";

interface IMediaItem {
  item: Movie | TVShow | Cast | Crew;
  horizontal?: boolean;
  anime?: boolean;
}

export const MEDIA_ITEM_HEIGHT = 224;

const MediaItem = ({ item, anime }: IMediaItem) => {
  const router = useRouter();

  const title = "title" in item ? item.title : item.name;
  const poster_path = "poster_path" in item ? item.poster_path : item.profile_path;

  function renderReleaseDate() {
    const releaseDate = "release_date" in item ? item.release_date : "first_air_date" in item ? item.first_air_date : null;

    if (!releaseDate) return;

    return `(${releaseDate.split("-")[0]})`;
  }

  function getCharacter() {
    if (!("character" in item)) return;

    return `(${item.character})`;
  }

  function getJob() {
    if (!("job" in item)) return;

    return `(${item.job})`;
  }

  function onPress() {
    if ("character" in item || "job" in item) {
      return;
    }
    const type = "title" in item ? "movie" : "tv";
    router.push(`/media/${item.id}?type=${type}&anime=${anime ? 1 : 0}`);
  }

  return (
    <Pressable style={{ flex: 1 }} onPress={onPress}>
      <MediaImage uri={getTMDBImageUrl(poster_path, "w342")} />

      <ThemedText
        type="link"
        style={styles.title}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={"character" in item ? 1 : 2}
      >
        {title} {renderReleaseDate()}
      </ThemedText>

      <ConditionRenderComponent renderIf={"character" in item}>
        <ThemedText type="link" style={styles.desc} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={2}>
          {getCharacter()}
        </ThemedText>
      </ConditionRenderComponent>

      <ConditionRenderComponent renderIf={"job" in item}>
        <ThemedText type="link" style={styles.desc} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={2}>
          {getJob()}
        </ThemedText>
      </ConditionRenderComponent>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 14,
    lineHeight: 16,
    color: "#acc2ec",
    textAlign: "center",
  },
  desc: {
    fontSize: 11,
    lineHeight: undefined,
    color: "#acc2ec",
    fontWeight: "600",
    textAlign: "center",
  },
});

export default MediaItem;
