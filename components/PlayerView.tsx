import axios from "axios";
import React, { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import WebView from "react-native-webview";
import { Colors } from "react-native/Libraries/NewAppScreen";

interface PlayerViewProps {
  link: string;
}

const PlayerView = ({ link }: PlayerViewProps) => {
  const dimensions = useWindowDimensions();
  const [mediaURL, setMediaURL] = React.useState<string | null>(null);

  useEffect(() => {
    setMediaURL(link);
  }, []);

  const adBlockerJS = `
    document.querySelectorAll('[id*="ad"], [class*="ad"], [class*="popup"], [id*="popup"]').forEach(el => el.remove());
    true; // Required to prevent WebView from showing error
  `;

  const searchParams = new URLSearchParams(mediaURL?.split("?")[1]);
  searchParams.set("autoplay", "true");
  searchParams.set("ds_lang", "en");
  const finalUrl = mediaURL ? `${mediaURL.split("?")[0]}?${searchParams.toString()}` : null;

  console.log("finalUrl", finalUrl);

  if (!mediaURL) return null;

  return (
    <View
      style={{
        // [dimensions.width < dimensions.height ? "width" : "height"]: "100%",
        width: Math.min(dimensions.width, dimensions.height),
        paddingVertical: 16,
        justifyContent: "center",
        aspectRatio: 16 / 9,
        backgroundColor: "black",
      }}
    >
      <WebView
        key={finalUrl}
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
          axios.get(request.url);

          // if (request.url.includes("vidsrc") || request.url.includes('rcp') ) setMediaURL(request.url);
          // Intercept and block popups or ad URLs based on conditions
          // return request.url.includes("vidsrc") || request.url.includes("blank") || request.url.includes("rcp");
          if (request.url.includes("about:blank") || request.url.includes("about:srcdoc")) {
            return false;
          }
          if (request.url.includes("vidsrc") || request.url.includes("rcp") || request.url.includes("cloudflare.com")) {
            return true;
          }

          axios.get(request.url).catch(() => {});
          return false;
        }}
        // userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36"
        source={{ uri: finalUrl! }}
        style={{ backgroundColor: Colors.dark.background, width: Math.min(dimensions.width, dimensions.height) }}
        forceDarkOn
        onError={(error) => console.log(error)}
      />
    </View>
  );
};

export default PlayerView;
