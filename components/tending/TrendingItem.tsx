import { TrendingItem } from "@/api/tmdb";
import { getTMDBGenre, getTMDBImageUrl } from "@/api/tmdb-client";
import { normalizeRating } from "@/constants/utilities";
import { Ionicons } from "@expo/vector-icons";
import { ImageBackground } from "expo-image";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../ThemedText";

interface TrendingItemProps {
  item: TrendingItem;
  onPress: () => void;
}

const TrendingItemView = ({ item, onPress }: TrendingItemProps) => {
  const safeAreaInset = useSafeAreaInsets();
  const year = item.release_date?.split("-")[0] ?? item.first_air_date?.split("-")[0];

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri: getTMDBImageUrl(item.backdrop_path, Platform.select({ native: "w780", default: "original" })) }}
        style={[styles.container, { paddingTop: safeAreaInset.top }]}
        // imageStyle={{ aspectRatio: 16 / 9 }}
        contentFit="cover"
        contentPosition={"center"}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.2)" }]} />
        <ThemedText color="#d1d5db" type="title">
          {item.title ?? item.name} ({year})
        </ThemedText>

        <View style={styles.stats}>
          <View style={styles.borderedView}>
            <ThemedText type="subtitle" style={styles.info}>
              {item.genre_ids
                .slice(0, 2)
                .map((id) => getTMDBGenre(id))
                .join(", ")}
            </ThemedText>
          </View>
          <View style={styles.borderedView}>
            <Ionicons
              name={item.vote_average >= 7.5 ? "star" : item.vote_average >= 5 ? "star-half" : "star-outline"}
              size={11}
              color="#fbbf24"
            />
            <ThemedText type="subtitle" style={styles.info}>
              {normalizeRating(item.vote_average)}
            </ThemedText>
          </View>
          <View style={[styles.borderedView, { borderRightColor: "transparent" }]}>
            <ThemedText type="subtitle" style={styles.info}>
              {item.release_date ?? item.first_air_date}
            </ThemedText>
          </View>
        </View>
        <ThemedText color="#d1d5db" numberOfLines={3}>
          {item.overview}
        </ThemedText>
      </ImageBackground>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
    backgroundColor: "#0e1423",
  },
  stats: {
    alignSelf: "flex-start",
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#155eddce",
  },
  borderedView: {
    paddingHorizontal: 4,
    borderRightWidth: 2,
    borderRightColor: "#abb9d0ac",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  info: {
    color: "#b7c7de",
    fontSize: 12,
  },
});

export default TrendingItemView;
