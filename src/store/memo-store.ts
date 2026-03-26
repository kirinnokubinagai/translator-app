import { create } from "zustand";
import type { Memo } from "@/types/memo";
import {
  getAllMemos,
  saveMemo,
  deleteMemo as deleteStoredMemo,
  clearAllMemos,
} from "@/services/storage/memo-storage";

type MemoState = {
  memos: Memo[];
  isLoading: boolean;
  loadMemos: () => Promise<void>;
  addMemo: (memo: Memo) => Promise<void>;
  removeMemo: (id: string) => Promise<void>;
  clearMemos: () => Promise<void>;
};

/** メモストア */
export const useMemoStore = create<MemoState>((set) => ({
  memos: [],
  isLoading: false,

  loadMemos: async () => {
    set({ isLoading: true });
    const memos = await getAllMemos();
    set({ memos, isLoading: false });
  },

  addMemo: async (memo) => {
    await saveMemo(memo);
    set((state) => ({ memos: [memo, ...state.memos] }));
  },

  removeMemo: async (id) => {
    await deleteStoredMemo(id);
    set((state) => ({ memos: state.memos.filter((m) => m.id !== id) }));
  },

  clearMemos: async () => {
    await clearAllMemos();
    set({ memos: [] });
  },
}));
