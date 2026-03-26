import { create } from "zustand";
import type { ConversationMessage, Speaker } from "@/types/conversation";
import type { LanguageCode } from "@/types/language";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE } from "@/constants/languages";

type ConversationState = {
  messages: ConversationMessage[];
  activeSpeaker: Speaker;
  isRecording: boolean;
  speaker1Language: LanguageCode;
  speaker2Language: LanguageCode;
  addMessage: (message: ConversationMessage) => void;
  setActiveSpeaker: (speaker: Speaker) => void;
  setIsRecording: (recording: boolean) => void;
  setSpeaker1Language: (lang: LanguageCode) => void;
  setSpeaker2Language: (lang: LanguageCode) => void;
  clearMessages: () => void;
};

/** 会話ストア */
export const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  activeSpeaker: "speaker1",
  isRecording: false,
  speaker1Language: DEFAULT_SOURCE_LANGUAGE,
  speaker2Language: DEFAULT_TARGET_LANGUAGE,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setActiveSpeaker: (speaker) => set({ activeSpeaker: speaker }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setSpeaker1Language: (lang) => set({ speaker1Language: lang }),
  setSpeaker2Language: (lang) => set({ speaker2Language: lang }),
  clearMessages: () => set({ messages: [] }),
}));
