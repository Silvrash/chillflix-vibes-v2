import { ActivityIndicator } from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

interface RenderProps {
  renderIf: boolean;
  children?: React.ReactNode;
}

export type ConditionRenderProps<T = Record<string, any>> = T & RenderProps;

function ConditionRender<P extends object>(Component: React.ComponentType<P>) {
  const CComponent = function ({ renderIf, ...props }: ConditionRenderProps<P>) {
    if (!renderIf) return null;
    return <Component {...(props as P)} />;
  };
  CComponent.name = Component.displayName;
  return CComponent;
}

export const ConditionRenderComponent: React.FC<RenderProps> = ({ renderIf, children }) => {
  if (!renderIf) return null;
  return <>{children}</>;
};

export const ActivityIndicatorIf = ConditionRender(ActivityIndicator);
export const ThemedTextIf = ConditionRender(ThemedText);
export const ThemedViewIf = ConditionRender(ThemedView);

export default ConditionRender;
