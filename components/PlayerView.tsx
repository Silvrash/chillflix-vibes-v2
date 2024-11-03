import axios from "axios";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import WebView from "react-native-webview";
import { Colors } from "react-native/Libraries/NewAppScreen";

interface PlayerViewProps {
  link: string;
}

const PlayerView = ({ link }: PlayerViewProps) => {
  const dimensions = useWindowDimensions();
  // const [mediaURL, setMediaURL] = React.useState<string>(link);

  // useEffect(() => {
  //   setMediaURL(link);
  // }, []);

  const adBlockerJS = `
    document.querySelectorAll('[id*="ad"], [class*="ad"], [class*="popup"], [id*="popup"]').forEach(el => el.remove());
    true; // Required to prevent WebView from showing error
  `;

  // const searchParams = new URLSearchParams(mediaURL?.split("?")[1]);
  // searchParams.set("autoplay", "true");
  // searchParams.set("ds_lang", "en");
  // const finalUrl = mediaURL ? `${mediaURL.split("?")[0]}?${searchParams.toString()}` : null;

  // console.log("finalUrl", finalUrl);

  // if (!mediaURL) return null;

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

          // if (request.url.includes("vidsrc") || request.url.includes('rcp') ) setMediaURL(request.url);
          // Intercept and block popups or ad URLs based on conditions
          // return request.url.includes("vidsrc") || request.url.includes("blank") || request.url.includes("rcp");
          if (request.url.includes("about:blank") || request.url.includes("about:srcdoc")) {
            return false;
          }
          if (request.url.includes("vidsrc") || request.url.includes("rcp")) {
            return true;
          }

          axios.get(request.url).catch((e) => {
            console.log("error", e);
          });
          return false;
        }}
        // userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36"
        source={{ uri: link! }}
        style={{ backgroundColor: Colors.dark.background, width: Math.min(dimensions.width, dimensions.height) }}
        forceDarkOn
        onError={(error) => console.log(error)}
      />
    </View>
  );
};

export default PlayerView;
