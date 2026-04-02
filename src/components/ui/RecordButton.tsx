import * as Haptics from "expo-haptics";
import { Mic, Square } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";
import { useSettingsStore } from "@/store/settings-store";

type RecordButtonProps = {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  label?: string;
  testID?: string;
};

/** パルスアニメーションの周期（ミリ秒） */
const PULSE_DURATION_MS = 1200;

/**
 * 録音ボタンコンポーネント
 *
 * 録音中はリング状のパルスアニメーションを表示する。
 */
export function RecordButton({
  isRecording,
  onPress,
  disabled = false,
  size = 80,
  label,
  testID,
}: RecordButtonProps) {
  const { hapticFeedback } = useSettingsStore();
  const t = useT();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: PULSE_DURATION_MS,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: PULSE_DURATION_MS,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();
    }
    if (!isRecording) {
      if (pulseRef.current) {
        pulseRef.current.stop();
        pulseRef.current = null;
      }
      pulseAnim.setValue(0);
    }

    return () => {
      if (pulseRef.current) {
        pulseRef.current.stop();
      }
    };
  }, [isRecording, pulseAnim]);

  const handlePress = () => {
    if (disabled) return;
    if (hapticFeedback) {
      Haptics.impactAsync(
        isRecording ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy,
      );
    }
    onPress();
  };

  /** パルスリングのスケール */
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  /** パルスリングの不透明度 */
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: size * 1.6,
          height: size * 1.6,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* パルスリング（録音中のみ表示） */}
        {isRecording ? (
          <Animated.View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 3,
              borderColor: THEME.colors.error,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            }}
          />
        ) : null}

        <Pressable
          onPress={handlePress}
          disabled={disabled}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={
            isRecording ? t("accessibility.recordStop") : t("accessibility.recordStart")
          }
          accessibilityState={{ disabled }}
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
      </View>
      {label ? (
        <Text style={{ fontSize: 14, color: THEME.colors.textSecondary }}>{label}</Text>
      ) : null}
    </View>
  );
}
