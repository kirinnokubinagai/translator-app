import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Volume2, Trash2, Copy } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { getMemoById } from "@/services/storage/memo-storage";
import { useMemoStore } from "@/store/memo-store";
import { speak } from "@/services/api/tts";
import { Button } from "@/components/ui/Button";
import { LANGUAGES } from "@/constants/languages";
import { THEME } from "@/constants/theme";
import type { Memo } from "@/types/memo";

/**
 * メモ詳細画面
 */
export default function MemoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [memo, setMemo] = useState<Memo | null>(null);
  const { removeMemo } = useMemoStore();

  useEffect(() => {
    if (!id) return;
    getMemoById(id).then(setMemo);
  }, [id]);

  if (!memo) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: THEME.colors.background,
        }}
      >
        <Text style={{ color: THEME.colors.textSecondary }}>
          メモが見つかりません
        </Text>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    Alert.alert("確認", "このメモを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await removeMemo(memo.id);
          router.back();
        },
      },
    ]);
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("コピーしました");
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString("ja-JP");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 12, color: THEME.colors.textSecondary }}>
          {LANGUAGES[memo.sourceLanguage].nativeName} →{" "}
          {LANGUAGES[memo.targetLanguage].nativeName} ・{" "}
          {formatDate(memo.createdAt)}
        </Text>

        <View
          style={{
            backgroundColor: THEME.colors.surface,
            padding: 16,
            borderRadius: THEME.borderRadius.md,
            borderWidth: 1,
            borderColor: THEME.colors.border,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: THEME.colors.textSecondary,
            }}
          >
            原文
          </Text>
          <Text style={{ fontSize: 16, color: THEME.colors.text, lineHeight: 24 }}>
            {memo.originalText}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Pressable
              onPress={() => speak(memo.originalText, memo.sourceLanguage)}
            >
              <Volume2 size={20} color={THEME.colors.primary} />
            </Pressable>
            <Pressable onPress={() => handleCopy(memo.originalText)}>
              <Copy size={20} color={THEME.colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View
          style={{
            backgroundColor: THEME.colors.primaryLight,
            padding: 16,
            borderRadius: THEME.borderRadius.md,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: THEME.colors.primaryDark,
            }}
          >
            翻訳
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: THEME.colors.text,
              lineHeight: 28,
            }}
          >
            {memo.translatedText}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Pressable
              onPress={() => speak(memo.translatedText, memo.targetLanguage)}
            >
              <Volume2 size={20} color={THEME.colors.primary} />
            </Pressable>
            <Pressable onPress={() => handleCopy(memo.translatedText)}>
              <Copy size={20} color={THEME.colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <Button variant="danger" onPress={handleDelete}>
          <Trash2 size={18} color="#ffffff" />
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
            削除
          </Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
