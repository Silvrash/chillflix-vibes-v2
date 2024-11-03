import React from "react";
import { useWindowDimensions, View } from "react-native";
import WebView from "react-native-webview";
import { Colors } from "react-native/Libraries/NewAppScreen";

interface PlayerViewProps {
  link: string;
}

const PlayerView = ({ link }: PlayerViewProps) => {
  const dimensions = useWindowDimensions()

  const adBlockerJS = `
    document.querySelectorAll('[id*="ad"], [class*="ad"], [class*="popup"], [id*="popup"]').forEach(el => el.remove());
    true; // Required to prevent WebView from showing error
  `;

  return (
    <View
      style={{
        // [dimensions.width < dimensions.height ? "width" : "height"]: "100%",
        width: Math.min(dimensions.width, dimensions.height),
        paddingVertical: 16,
        justifyContent: "center",
        aspectRatio: 16 / 9,
      }}
    >
      <WebView
        key={link}
        originWhitelist={["*"]}
        automaticallyAdjustContentInsets={false}
        javaScriptCanOpenWindowsAutomatically
        javaScriptEnabled
        allowsFullscreenVideo
        injectedJavaScript={adBlockerJS}
        scrollEnabled={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        domStorageEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => {
          console.log("request", request.url);
          // Intercept and block popups or ad URLs based on conditions
          // return request.url.includes("vidsrc") || request.url.includes("blank") || request.url.includes("rcp");
          if (request.url.includes("about:blank") || request.url.includes("about:srcdoc")) return false;
          return request.url.includes("vidsrc") || request.url.includes("rcp");
        }}
        // userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36"
        source={{ uri: link }}
        style={{ backgroundColor: Colors.dark.background, width: Math.min(dimensions.width, dimensions.height) }}
        forceDarkOn
        fraudulentWebsiteWarningEnabled
        onError={(error) => console.log(error)}
      />
    </View>
  );
};

export default PlayerView;
