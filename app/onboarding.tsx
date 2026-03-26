import { useState } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageSquare, Subtitles, Mic } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSettingsStore } from "@/store/settings-store";
import { THEME } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Slide = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

/** スライドデータ */
const SLIDES: Slide[] = [
  {
    icon: <MessageSquare size={72} color={THEME.colors.primary} />,
    title: "対面通訳",
    description: "2人が向かい合って会話。\n上半分は相手に見せます。",
  },
  {
    icon: <Subtitles size={72} color={THEME.colors.primary} />,
    title: "リアルタイム字幕",
    description: "話した内容がリアルタイムで\n翻訳字幕として表示。",
  },
  {
    icon: <Mic size={72} color={THEME.colors.primary} />,
    title: "音声メモ",
    description: "録音→翻訳→保存。\n後から確認できます。",
  },
];

/** ドットインジケーター */
function DotIndicator({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              index === current ? THEME.colors.primary : THEME.colors.border,
          }}
        />
      ))}
    </View>
  );
}

/**
 * オンボーディング画面
 * 初回起動時に表示される3スライドのウォークスルー
 */
export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const setHasCompletedOnboarding = useSettingsStore(
    (s) => s.setHasCompletedOnboarding
  );

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleComplete = () => {
    setHasCompletedOnboarding(true);
    router.replace("/(tabs)/conversation");
  };

  const slide = SLIDES[currentIndex];

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: THEME.colors.background,
      }}
    >
      {/* スキップボタン */}
      <View style={{ alignItems: "flex-end", padding: THEME.spacing.md }}>
        {!isLast ? (
          <Pressable onPress={handleComplete}>
            <Text
              style={{
                fontSize: 15,
                color: THEME.colors.textSecondary,
              }}
            >
              スキップ
            </Text>
          </Pressable>
        ) : (
          <View style={{ height: 22 }} />
        )}
      </View>

      {/* スライドコンテンツ */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: THEME.spacing.xl,
          gap: THEME.spacing.lg,
        }}
      >
        <View
          style={{
            width: 144,
            height: 144,
            borderRadius: THEME.borderRadius.lg,
            backgroundColor: THEME.colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {slide.icon}
        </View>

        <View style={{ alignItems: "center", gap: THEME.spacing.sm }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: THEME.colors.text,
              textAlign: "center",
            }}
          >
            {slide.title}
          </Text>
          <Text
            style={{
              fontSize: 17,
              color: THEME.colors.textSecondary,
              textAlign: "center",
              lineHeight: 26,
            }}
          >
            {slide.description}
          </Text>
        </View>
      </View>

      {/* ドットとボタン */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: THEME.spacing.xl,
          paddingBottom: THEME.spacing.xl,
          gap: THEME.spacing.lg,
        }}
      >
        <DotIndicator total={SLIDES.length} current={currentIndex} />

        <Pressable
          onPress={handleNext}
          style={{
            width: "100%",
            backgroundColor: THEME.colors.primary,
            paddingVertical: 16,
            borderRadius: THEME.borderRadius.md,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: "#ffffff",
            }}
          >
            {isLast ? "始める" : "次へ"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
