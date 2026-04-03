import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { t } from "@/i18n";
import { logger } from "@/lib/logger";
import { addQuotaByAd, fetchQuotaBalance, initQuota, purchaseQuota } from "@/services/api/quota";
import { useSettingsStore } from "@/store/settings-store";
import type { QuotaPackType } from "@/types/quota";

/** ローカルキャッシュがstaleと判定される閾値（ミリ秒） */
const STALE_THRESHOLD_MS = 30_000;

type QuotaState = {
  /** ローカルキャッシュ残高（サーバー値を正として定期同期する） */
  balance: number;
  totalPurchased: number;
  totalEarnedByAd: number;
  totalConsumed: number;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  /** サーバーから最後に同期した時刻（エポックミリ秒） */
  lastSyncedAt: number;

  /** 初期化（初回起動時に呼ぶ） */
  initialize: () => Promise<void>;

  /** サーバーから残高を同期（正の値として上書き） */
  syncBalance: () => Promise<void>;

  /** ローカルキャッシュがstaleかどうか */
  isStale: () => boolean;

  /** 広告視聴でクォータ追加（nonce付き） */
  earnByAd: (nonce: string) => Promise<boolean>;

  /** 課金パック購入 */
  purchase: (
    pack: QuotaPackType,
    transactionId: string,
    productId?: string,
    appUserId?: string,
  ) => Promise<boolean>;

  /** ローカル残高を即時減算（楽観的更新） */
  deductLocal: (amount: number) => void;

  /** エラーをクリア */
  clearError: () => void;
};

/** クォータストア */
export const useQuotaStore = create<QuotaState>()(
  persist(
    (set, get) => ({
      balance: 0,
      totalPurchased: 0,
      totalEarnedByAd: 0,
      totalConsumed: 0,
      isInitialized: false,
      isLoading: false,
      error: null,
      lastSyncedAt: 0,

      initialize: async () => {
        if (get().isInitialized) {
          await get().syncBalance();
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const res = await initQuota();
          set({
            balance: res.data.balance,
            isInitialized: true,
            isLoading: false,
            lastSyncedAt: Date.now(),
          });
          logger.info("クォータ初期化完了", {
            balance: String(res.data.balance),
            isNew: String(res.data.isNew),
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "errors.quotaInitFailed");
          set({ isLoading: false, error: message });
          logger.error("クォータ初期化エラー", { error: message });
        }
      },

      syncBalance: async () => {
        try {
          const res = await fetchQuotaBalance();
          set({
            balance: res.data.balance,
            totalPurchased: res.data.totalPurchased,
            totalEarnedByAd: res.data.totalEarnedByAd,
            totalConsumed: res.data.totalConsumed,
            lastSyncedAt: Date.now(),
          });
        } catch (error) {
          logger.warn("クォータ残高同期失敗", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },

      isStale: () => Date.now() - get().lastSyncedAt > STALE_THRESHOLD_MS,

      earnByAd: async (nonce: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await addQuotaByAd(nonce);
          set({
            balance: res.data.balance,
            totalEarnedByAd: get().totalEarnedByAd + res.data.added,
            isLoading: false,
          });
          logger.info("広告視聴クォータ追加", { added: String(res.data.added) });
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "errors.quotaAddFailed");
          set({ isLoading: false, error: message });
          return false;
        }
      },

      purchase: async (pack, transactionId, productId, appUserId) => {
        set({ isLoading: true, error: null });
        try {
          const res = await purchaseQuota(pack, transactionId, productId, appUserId);
          set({
            balance: res.data.balance,
            totalPurchased: get().totalPurchased + res.data.added,
            isLoading: false,
          });
          logger.info("クォータ購入完了", {
            pack: res.data.pack,
            added: String(res.data.added),
          });
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "errors.purchaseFailed");
          set({ isLoading: false, error: message });
          return false;
        }
      },

      deductLocal: (amount) => {
        set((state) => ({
          balance: Math.max(0, state.balance - amount),
          totalConsumed: state.totalConsumed + amount,
        }));
        // stale の場合はバックグラウンドでサーバー同期（fire-and-forget）
        if (get().isStale()) {
          get()
            .syncBalance()
            .catch(() => {});
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "translator-quota",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        balance: state.balance,
        totalPurchased: state.totalPurchased,
        totalEarnedByAd: state.totalEarnedByAd,
        totalConsumed: state.totalConsumed,
        isInitialized: state.isInitialized,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);
