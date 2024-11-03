import { useEffect, useState } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";

function useDynamicColumns() {
  const dimensions = useWindowDimensions();
  const [numColumns, setNumColumns] = useState(calculateColumns()); // Default column count

  useEffect(() => {
    const onChange = () => setNumColumns(calculateColumns());
    const subscription = Dimensions.addEventListener("change", onChange);
    return subscription.remove;
  }, [dimensions.width]);

  function calculateColumns() {
    const itemWidth = Platform.select({ web: 150, default: 127.3 });
    let deviceWidth = dimensions.width;

    if (Platform.OS === "web") {
      deviceWidth = document.getElementById("root")?.clientWidth || deviceWidth;
    }
    const columns = Math.floor(deviceWidth / itemWidth);
    return Math.max(columns, 3);
  }

  return numColumns;
}

export default useDynamicColumns;
