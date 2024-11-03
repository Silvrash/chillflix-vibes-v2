import { Tabs } from "expo-router";
import React from "react";

import { Colors } from "@/constants/Colors";
import { Entypo, Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="movies"
      screenOptions={{
        tabBarActiveTintColor: Colors["dark"].tint,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="movies"
        options={{
          title: "Movies",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "film" : "film-outline"} size={28} style={{ marginBottom: -3 }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tv"
        options={{
          title: "Tv Shows",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "tv" : "tv-outline"} size={28} style={{ marginBottom: -3 }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="anime"
        options={{
          title: "Anime",
          tabBarIcon: ({ color, focused }) => (
            <Entypo name={focused ? "emoji-flirt" : "emoji-neutral"} size={28} style={{ marginBottom: -3 }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
