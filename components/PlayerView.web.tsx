import React, { useLayoutEffect, useRef } from "react";
import { StyleSheet } from "react-native";

interface PlayerViewProps {
  link: string;
  fullScreen?: boolean;
}

const PlayerView = ({ link, fullScreen = true }: PlayerViewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.focus(); // Focus the iframe when component mounts
    }
  }, []);

  return (
    <div
      className="container"
      style={{
        ...styles.fullScreen,
        maxHeight: !fullScreen ? "80%" : "100%",
      }}
    >
      <iframe
        ref={iframeRef}
        src={link}
        referrerPolicy="origin"
        allowFullScreen
        className="container"
        scrolling="no"
        autoFocus
        tabIndex={0}
        style={{ width: "100%", height: "100%", border: 0, alignSelf: "center", overflow: "hidden", resize: "vertical" }}
      />
    </div>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    position: "absolute",
    backgroundColor: "black",
  },
});

export default PlayerView;
