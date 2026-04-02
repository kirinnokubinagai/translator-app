import { create } from "zustand";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE } from "@/constants/languages";
import type { ConversationMessage, Speaker } from "@/types/conversation";
import type { LanguageCode } from "@/types/language";

type ConversationState = {
  messages: ConversationMessage[];
  activeSpeaker: Speaker;
  speaker1Language: LanguageCode;
  speaker2Language: LanguageCode;
  addMessage: (message: ConversationMessage) => void;
  setActiveSpeaker: (speaker: Speaker) => void;
  setSpeaker1Language: (lang: LanguageCode) => void;
  setSpeaker2Language: (lang: LanguageCode) => void;
  clearMessages: () => void;
};

/** 会話ストア */
export const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  activeSpeaker: "speaker1",
  speaker1Language: DEFAULT_SOURCE_LANGUAGE,
  speaker2Language: DEFAULT_TARGET_LANGUAGE,

  addMessage: (message) => set((state) => ({ messages: [...state.messages.slice(-99), message] })),
  setActiveSpeaker: (speaker) => set({ activeSpeaker: speaker }),
  setSpeaker1Language: (lang) => set({ speaker1Language: lang }),
  setSpeaker2Language: (lang) => set({ speaker2Language: lang }),
  clearMessages: () => set({ messages: [] }),
}));
