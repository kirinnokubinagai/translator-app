import { Pressable, View, Text } from "react-native";
import { Mic, Square } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSettingsStore } from "@/store/settings-store";
import { THEME } from "@/constants/theme";

type RecordButtonProps = {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  label?: string;
};

/**
 * 録音ボタンコンポーネント
 */
export function RecordButton({
  isRecording,
  onPress,
  disabled = false,
  size = 80,
  label,
}: RecordButtonProps) {
  const { hapticFeedback } = useSettingsStore();

  const handlePress = () => {
    if (disabled) return;
    if (hapticFeedback) {
      Haptics.impactAsync(
        isRecording
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy
      );
    }
    onPress();
  };

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isRecording ? THEME.colors.error : THEME.colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        })}
      >
        {isRecording ? (
          <Square size={size * 0.35} color="#ffffff" fill="#ffffff" />
        ) : (
          <Mic size={size * 0.4} color="#ffffff" />
        )}
      </Pressable>
      {label ? (
        <Text style={{ fontSize: 14, color: THEME.colors.textSecondary }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
