import { useState } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageSquare, Subtitles, Mic } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSettingsStore } from "@/store/settings-store";
import { useT } from "@/i18n";
import { THEME } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const t = useT();

  /** スライドデータ */
  const slides = [
    {
      icon: <MessageSquare size={72} color={THEME.colors.primary} />,
      title: t("onboarding.slide1Title"),
      description: t("onboarding.slide1Description"),
    },
    {
      icon: <Subtitles size={72} color={THEME.colors.primary} />,
      title: t("onboarding.slide2Title"),
      description: t("onboarding.slide2Description"),
    },
    {
      icon: <Mic size={72} color={THEME.colors.primary} />,
      title: t("onboarding.slide3Title"),
      description: t("onboarding.slide3Description"),
    },
  ];

  const isLast = currentIndex === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleComplete = () => {
    setHasCompletedOnboarding(true);
    router.replace("/login");
  };

  const slide = slides[currentIndex];

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
              {t("common.skip")}
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
        <DotIndicator total={slides.length} current={currentIndex} />

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
            {isLast ? t("common.start") : t("common.next")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
