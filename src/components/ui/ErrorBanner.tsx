import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { AlertCircle, X, WifiOff, Coins, RefreshCw } from "lucide-react-native";
import { useRouter } from "expo-router";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";

/** エラー種別 */
type ErrorType = "network" | "quota" | "server" | "generic";

/** 自動非表示までの時間（ミリ秒） */
const AUTO_DISMISS_MS = 5000;

/** サーバーエラーの自動リトライ間隔（秒） */
const RETRY_COUNTDOWN_SEC = 10;

/** クリティカルエラー（自動非表示しない）のキーワード */
const CRITICAL_KEYWORDS = ["quota", "クォータ", "認証", "auth"];

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
};

/**
 * メッセージからエラー種別を判定する
 */
function detectErrorType(message: string): ErrorType {
  const lower = message.toLowerCase();
  if (lower.includes("network") || lower.includes("ネットワーク") || lower.includes("接続") || lower.includes("connection")) {
    return "network";
  }
  if (lower.includes("quota") || lower.includes("クォータ") || lower.includes("insufficient")) {
    return "quota";
  }
  if (lower.includes("server") || lower.includes("サーバー") || lower.includes("500") || lower.includes("502")) {
    return "server";
  }
  return "generic";
}

/**
 * クリティカルエラーかどうかを判定する
 */
function isCriticalError(message: string): boolean {
  const lower = message.toLowerCase();
  return CRITICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * エラーバナーコンポーネント
 *
 * エラー種別に応じたアクションボタンを表示する:
 * - ネットワークエラー: 「再接続」ボタン
 * - クォータ不足: 「クォータを追加」ボタン（quota画面へ遷移）
 * - サーバーエラー: 「再試行」ボタン + 自動リトライカウントダウン
 * - 非クリティカルエラーは5秒後にフェードアウトで自動非表示
 */
export function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  const t = useT();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const errorType = detectErrorType(message);
  const critical = isCriticalError(message);
  const [countdown, setCountdown] = useState(
    errorType === "server" ? RETRY_COUNTDOWN_SEC : 0
  );
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // サーバーエラーの自動リトライカウントダウン
  useEffect(() => {
    if (errorType !== "server" || !onRetry) return;

    setCountdown(RETRY_COUNTDOWN_SEC);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          onRetry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [errorType, onRetry]);

  // 非クリティカルエラーの自動非表示
  useEffect(() => {
    if (critical || !onDismiss) return;

    dismissTimerRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onDismiss();
      });
    }, AUTO_DISMISS_MS);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [critical, onDismiss, fadeAnim]);

  /** クォータ画面へ遷移する */
  const handleGoToQuota = () => {
    router.push("/quota");
  };

  /** エラー種別に対応するアイコンを返す */
  const renderIcon = () => {
    if (errorType === "network") {
      return <WifiOff size={20} color={THEME.colors.error} />;
    }
    if (errorType === "quota") {
      return <Coins size={20} color={THEME.colors.warning} />;
    }
    return <AlertCircle size={20} color={THEME.colors.error} />;
  };

  /** エラー種別に応じたバナー背景色 */
  const bgColor = errorType === "quota" ? THEME.colors.warningLight : THEME.colors.errorLight;
  /** エラー種別に応じたテキスト色 */
  const textColor = errorType === "quota" ? THEME.colors.warning : THEME.colors.error;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        flexDirection: "column",
        backgroundColor: bgColor,
        borderRadius: THEME.borderRadius.md,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {renderIcon()}
        <Text
          style={{ flex: 1, fontSize: 14, color: textColor }}
          numberOfLines={2}
        >
          {message}
        </Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss}>
            <X size={18} color={textColor} />
          </Pressable>
        ) : null}
      </View>

      {/* エラー種別に応じたアクションボタン */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {errorType === "network" && onRetry ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: THEME.borderRadius.sm,
              backgroundColor: pressed ? THEME.colors.error : `${THEME.colors.error}20`,
            })}
          >
            <WifiOff size={14} color={THEME.colors.error} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: THEME.colors.error }}>
              {t("errors.reconnect")}
            </Text>
          </Pressable>
        ) : null}

        {errorType === "quota" ? (
          <Pressable
            onPress={handleGoToQuota}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: THEME.borderRadius.sm,
              backgroundColor: pressed ? THEME.colors.warning : `${THEME.colors.warning}20`,
            })}
          >
            <Coins size={14} color={THEME.colors.warning} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: THEME.colors.warning }}>
              {t("errors.addQuota")}
            </Text>
          </Pressable>
        ) : null}

        {errorType === "server" && onRetry ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: THEME.borderRadius.sm,
              backgroundColor: pressed ? THEME.colors.error : `${THEME.colors.error}20`,
            })}
          >
            <RefreshCw size={14} color={THEME.colors.error} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: THEME.colors.error }}>
              {countdown > 0
                ? t("errors.retryIn", { seconds: String(countdown) })
                : t("common.retry")}
            </Text>
          </Pressable>
        ) : null}

        {errorType === "generic" && onRetry ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => ({
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: THEME.borderRadius.sm,
              backgroundColor: pressed ? THEME.colors.error : `${THEME.colors.error}20`,
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: THEME.colors.error }}>
              {t("common.retry")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
