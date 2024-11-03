import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { ThemedView } from "../ThemedView";

interface MediaImageProps {
  uri: string;
}

const MediaImage = ({ uri }: MediaImageProps) => {
  const [error, setError] = React.useState(false);

  return (
    <>
      {!error && (
        <Image
          source={{ uri, isAnimated: true }}
          onLoad={() => setError(false)}
          onError={() => setError(true)}
          style={{ width: "100%", aspectRatio: 2 / 3, borderRadius: 8 }}
        />
      )}

      {!!error && (
        <ThemedView
          style={{
            width: "100%",
            aspectRatio: 2 / 3,
            borderRadius: 8,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.1)",
          }}
        >
          <Ionicons name="film-sharp" size={48} color="gray" />
        </ThemedView>
      )}
    </>
  );
};

export default MediaImage;
