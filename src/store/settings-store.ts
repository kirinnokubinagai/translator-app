import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE } from "@/constants/languages";
import type { LanguageCode } from "@/types/language";

type SettingsState = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  autoPlayTts: boolean;
  hapticFeedback: boolean;
  locale: "ja" | "en";
  hasCompletedOnboarding: boolean;
  setSourceLanguage: (lang: LanguageCode) => void;
  setTargetLanguage: (lang: LanguageCode) => void;
  swapLanguages: () => void;
  setAutoPlayTts: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setLocale: (locale: "ja" | "en") => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
};

/** 設定ストア */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      autoPlayTts: true,
      hapticFeedback: true,
      locale: "ja",
      hasCompletedOnboarding: false,

      setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
      setTargetLanguage: (lang) => set({ targetLanguage: lang }),
      swapLanguages: () =>
        set((state) => ({
          sourceLanguage: state.targetLanguage,
          targetLanguage: state.sourceLanguage,
        })),
      setAutoPlayTts: (enabled) => set({ autoPlayTts: enabled }),
      setHapticFeedback: (enabled) => set({ hapticFeedback: enabled }),
      setLocale: (locale) => set({ locale }),
      setHasCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),
    }),
    {
      name: "translator-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
