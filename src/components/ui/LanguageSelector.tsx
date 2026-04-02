import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View, type ViewStyle } from "react-native";
import { LANGUAGE_CODES, LANGUAGES } from "@/constants/languages";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";
import type { LanguageCode } from "@/types/language";

type LanguageSelectorProps = {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  label?: string;
  style?: ViewStyle;
  /** コンパクト表示（会話画面用：小さいフォント・パディング） */
  compact?: boolean;
};

/**
 * 言語選択コンポーネント
 */
export function LanguageSelector({
  value,
  onChange,
  label,
  style,
  compact = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = LANGUAGES[value];
  const t = useT();

  return (
    <View style={style}>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            color: THEME.colors.textSecondary,
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("accessibility.languageSelect", {
          label: label ?? t("accessibility.selectLanguage"),
          language: selected.nativeName,
        })}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: THEME.colors.surface,
          borderWidth: 1,
          borderColor: THEME.colors.border,
          borderRadius: compact ? THEME.borderRadius.sm : THEME.borderRadius.md,
          paddingHorizontal: compact ? 10 : 16,
          paddingVertical: compact ? 6 : 12,
        }}
      >
        <Text style={{ fontSize: compact ? 13 : 16, color: THEME.colors.text }}>
          {selected.nativeName}
        </Text>
        <ChevronDown size={compact ? 14 : 20} color={THEME.colors.textSecondary} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="slide">
        <Pressable
          onPress={() => setIsOpen(false)}
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
              paddingTop: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                textAlign: "center",
                marginBottom: 16,
                color: THEME.colors.text,
              }}
            >
              {t("languageSelector.selectLanguage")}
            </Text>
            <FlatList
              data={LANGUAGE_CODES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const lang = LANGUAGES[item];
                const isSelected = item === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setIsOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      backgroundColor: isSelected ? THEME.colors.primaryLight : "transparent",
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
                    {isSelected ? <Check size={20} color={THEME.colors.primary} /> : null}
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
