import { TrendingItem } from "@/api/tmdb";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { Fragment } from "react";
import { TouchableOpacity, useWindowDimensions } from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import TrendingItemView from "./TrendingItem";

interface CarouselProps {
  data: TrendingItem[];
  animeOnly?: boolean;
}

const CarouselView = ({ data, animeOnly }: CarouselProps) => {
  const pagerRef = React.useRef<ICarouselInstance>(null);
  const dimensions = useWindowDimensions();

  const router = useRouter();

  function goToNext() {
    pagerRef.current?.next();
    console.log("next", data.length, pagerRef.current?.getCurrentIndex());
  }

  function goToPrev() {
    pagerRef.current?.prev();
    console.log("prev");
  }

  function onPress(index: number) {
    const item = data[index];
    const type = "title" in item ? "movie" : "tv";
    router.push(`/media/${item.id}?type=${type}&anime=${animeOnly ? 1 : 0}`);
  }

  return (
    <Fragment>
      <Carousel
        ref={pagerRef}
        data={data}
        style={{ flex: 1 }}
        width={dimensions.width}
        autoPlay
        loop
        autoPlayInterval={5000}
        renderItem={({ item, index }) => <TrendingItemView item={item} onPress={() => onPress(index)} />}
      />
      <TouchableOpacity style={{ position: "absolute", left: 0 }} onPress={goToPrev}>
        <Ionicons name="chevron-back-circle" size={32} color={"#bfcfe84f"} />
      </TouchableOpacity>

      <TouchableOpacity style={{ position: "absolute", right: 0 }} onPress={goToNext}>
        <Ionicons name="chevron-forward-circle" size={32} color={"#bfcfe84f"} />
      </TouchableOpacity>
    </Fragment>
  );
};

export default CarouselView;
