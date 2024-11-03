import { FlashList } from "@shopify/flash-list";
import React, { ForwardedRef, forwardRef, useMemo } from "react";
import { FlatList, FlatListProps, ListRenderItem, ListRenderItemInfo, View } from "react-native";
import { ActivityIndicatorIf } from "./ConditionRender";

interface ListViewProps<ItemT> extends FlatListProps<ItemT> {
  renderItem: ListRenderItem<ItemT>;
  isLoading?: boolean;
  useFlashList?: boolean;
}

// Helper function to add placeholders dynamically
export function addPlaceholders<T>(data: ListViewProps<T>["data"], numColumns: number) {
  if (!data) return [];
  const itemsToAdd = numColumns - (data.length % numColumns);
  if (itemsToAdd === 0) return data;
  return [...Array.from(data), ...Array(itemsToAdd).fill({ id: "placeholder" })];
}

function ListView<ItemT>({ isLoading, useFlashList, ...props }: ListViewProps<ItemT>, ref: ForwardedRef<FlatList<ItemT>>) {
  const data = useMemo(
    () => (!!props.numColumns ? addPlaceholders(props.data, props.numColumns) : props.data),
    [props.numColumns, props.data],
  );

  function keyExtractor(item: ItemT, index: number) {
    return (item as any)?.id === "placeholder" ? `placeholder-${index}` : (props.keyExtractor?.(item, index) ?? index.toString());
  }

  function renderItem(info: ListRenderItemInfo<ItemT>) {
    if ((info.item as any)?.id === "placeholder")
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicatorIf renderIf={!!isLoading} size={"large"} />
        </View>
      );
    return props.renderItem(info);
  }

  const List = useFlashList ? FlashList : FlatList;

  return <List {...props} ref={ref} data={data} keyExtractor={keyExtractor} renderItem={renderItem} />;
}

export default forwardRef(ListView) as <ItemT>(
  props: ListViewProps<ItemT> & { ref?: ForwardedRef<FlatList<ItemT>> },
) => JSX.Element;
