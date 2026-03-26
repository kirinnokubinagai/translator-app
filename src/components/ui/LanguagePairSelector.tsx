import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { ArrowLeftRight, ChevronDown, Check } from "lucide-react-native";
import { LANGUAGES, LANGUAGE_CODES } from "@/constants/languages";
import { THEME } from "@/constants/theme";
import type { LanguageCode } from "@/types/language";

type LanguagePairSelectorProps = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  onSourceChange: (lang: LanguageCode) => void;
  onTargetChange: (lang: LanguageCode) => void;
  onSwap: () => void;
};

type PickerTarget = "source" | "target" | null;

/**
 * コンパクトな言語ペア選択コンポーネント
 * [日本語 ▼] ⇄ [English ▼] の1行レイアウト
 */
export function LanguagePairSelector({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  onSwap,
}: LanguagePairSelectorProps) {
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const currentValue = pickerTarget === "source" ? sourceLanguage : targetLanguage;
  const handleSelect = (lang: LanguageCode) => {
    if (pickerTarget === "source") {
      onSourceChange(lang);
    }
    if (pickerTarget === "target") {
      onTargetChange(lang);
    }
    setPickerTarget(null);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: THEME.spacing.sm,
      }}
    >
      {/* ソース言語ボタン */}
      <Pressable
        onPress={() => setPickerTarget("source")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: THEME.colors.surface,
          borderWidth: 1,
          borderColor: THEME.colors.border,
          borderRadius: THEME.borderRadius.sm,
          paddingHorizontal: 12,
          paddingVertical: 8,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: THEME.colors.text }}>
          {LANGUAGES[sourceLanguage].nativeName}
        </Text>
        <ChevronDown size={14} color={THEME.colors.textSecondary} />
      </Pressable>

      {/* スワップボタン */}
      <Pressable
        onPress={onSwap}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => ({
          padding: 6,
          borderRadius: THEME.borderRadius.full,
          backgroundColor: pressed ? THEME.colors.primaryLight : "transparent",
        })}
      >
        <ArrowLeftRight size={18} color={THEME.colors.primary} />
      </Pressable>

      {/* ターゲット言語ボタン */}
      <Pressable
        onPress={() => setPickerTarget("target")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: THEME.colors.surface,
          borderWidth: 1,
          borderColor: THEME.colors.border,
          borderRadius: THEME.borderRadius.sm,
          paddingHorizontal: 12,
          paddingVertical: 8,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: THEME.colors.text }}>
          {LANGUAGES[targetLanguage].nativeName}
        </Text>
        <ChevronDown size={14} color={THEME.colors.textSecondary} />
      </Pressable>

      {/* 言語選択モーダル */}
      <Modal visible={pickerTarget !== null} transparent animationType="slide">
        <Pressable
          onPress={() => setPickerTarget(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: THEME.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "60%",
              paddingTop: THEME.spacing.md,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                textAlign: "center",
                marginBottom: THEME.spacing.md,
                color: THEME.colors.text,
              }}
            >
              {pickerTarget === "source" ? "入力言語を選択" : "翻訳言語を選択"}
            </Text>
            <FlatList
              data={LANGUAGE_CODES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const lang = LANGUAGES[item];
                const isSelected = item === currentValue;
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      backgroundColor: isSelected
                        ? THEME.colors.primaryLight
                        : "transparent",
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: isSelected ? "600" : "400",
                          color: THEME.colors.text,
                        }}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: THEME.colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {lang.name}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Check size={20} color={THEME.colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
