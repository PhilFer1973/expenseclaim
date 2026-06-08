/**
 * Cross-platform confirm dialog.
 *
 * On native we use Alert.alert (modal). On web we fall back to window.confirm
 * because Alert.alert is largely a no-op on react-native-web.
 */
import { Alert, Platform } from "react-native";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function confirm({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== "undefined" && window.confirm(message ? `${title}\n\n${message}` : title);
    return Promise.resolve(!!ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
