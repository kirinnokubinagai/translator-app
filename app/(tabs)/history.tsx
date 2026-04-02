import { useRouter } from "expo-router";
import { ArrowRight, History as HistoryIcon, Mic, Trash2, Volume2 } from "lucide-react-native";
import { useEffect } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { LANGUAGES } from "@/constants/languages";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";
import { speak } from "@/services/api/tts";
import { useMemoStore } from "@/store/memo-store";
import type { Memo } from "@/types/memo";

/**
 * 翻訳履歴画面
 * メモタブで保存された翻訳結果を一覧表示する
 */
export default function HistoryScreen() {
  const router = useRouter();
  const { memos, loadMemos, clearMemos } = useMemoStore();
  const t = useT();

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  const handleClear = () => {
    Alert.alert(t("common.confirm"), t("history.clearConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => clearMemos(),
      },
    ]);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMemo = ({ item }: { item: Memo }) => (
    <Pressable
      onPress={() => router.push(`/memo/${item.id}`)}
      style={({ pressed }) => ({
        backgroundColor: THEME.colors.surface,
        padding: THEME.spacing.md,
        marginHorizontal: THEME.spacing.md,
        marginBottom: THEME.spacing.sm,
        borderRadius: THEME.borderRadius.md,
        borderWidth: 1,
        borderColor: THEME.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {/* ヘッダー: 言語ペア + 日付 */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: THEME.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: THEME.colors.primaryLight,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: THEME.borderRadius.full,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: THEME.colors.primaryDark,
            }}
          >
            {LANGUAGES[item.sourceLanguage].nativeName}
          </Text>
          <ArrowRight size={10} color={THEME.colors.primaryDark} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: THEME.colors.primaryDark,
            }}
          >
            {LANGUAGES[item.targetLanguage].nativeName}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: THEME.colors.textMuted }}>
          {formatDate(item.createdAt)}
        </Text>
      </View>

      {/* 原文 */}
      <Text
        style={{
          fontSize: 14,
          color: THEME.colors.text,
          marginBottom: 4,
          lineHeight: 20,
        }}
        numberOfLines={2}
      >
        {item.originalText}
      </Text>

      {/* 翻訳文 */}
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: THEME.colors.primary,
          lineHeight: 22,
        }}
        numberOfLines={2}
      >
        {item.translatedText}
      </Text>

      {/* 再生ボタン */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginTop: THEME.spacing.sm,
        }}
      >
        <Pressable
          onPress={() => speak(item.translatedText, item.targetLanguage)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: THEME.borderRadius.sm,
            backgroundColor: pressed ? THEME.colors.primaryLight : "transparent",
          })}
        >
          <Volume2 size={16} color={THEME.colors.primary} />
          <Text
            style={{
              fontSize: 12,
              color: THEME.colors.primary,
              fontWeight: "500",
            }}
          >
            {t("common.play")}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      {/* クリアボタン */}
      {memos.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingHorizontal: THEME.spacing.md,
            paddingVertical: THEME.spacing.sm,
          }}
        >
          <Button variant="ghost" size="sm" onPress={handleClear}>
            <Trash2 size={16} color={THEME.colors.textSecondary} />
            <Text
              style={{
                color: THEME.colors.textSecondary,
                fontSize: 14,
              }}
            >
              {t("common.clear")}
            </Text>
          </Button>
        </View>
      ) : null}

      <FlatList
        data={memos}
        keyExtractor={(item) => item.id}
        renderItem={renderMemo}
        contentContainerStyle={{ paddingVertical: THEME.spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={<HistoryEmptyState t={t} />}
      />
    </SafeAreaView>
  );
}

type HistoryEmptyStateProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * 履歴の空状態コンポーネント
 */
function HistoryEmptyState({ t }: HistoryEmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: THEME.spacing.xl,
        gap: THEME.spacing.md,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: THEME.colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <HistoryIcon size={32} color={THEME.colors.primary} />
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: THEME.colors.text,
          textAlign: "center",
        }}
      >
        {t("history.noHistory")}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: THEME.colors.textSecondary,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {t("history.emptyDescription")}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: THEME.spacing.sm,
          backgroundColor: THEME.colors.surface,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: THEME.borderRadius.sm,
          borderWidth: 1,
          borderColor: THEME.colors.border,
        }}
      >
        <Mic size={16} color={THEME.colors.textMuted} />
        <Text style={{ fontSize: 13, color: THEME.colors.textMuted }}>
          {t("history.emptyHint")}
        </Text>
      </View>
    </View>
  );
}
