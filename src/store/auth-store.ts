import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { t } from "@/i18n";
import { logger } from "@/lib/logger";
import {
  signOut as authSignOut,
  getStoredSessionToken,
  getStoredUser,
  signInWithEmail,
  signInWithSocial,
  signUpWithEmail,
} from "@/services/auth";
import { getAuthClient } from "@/services/auth/client";
import { logOutRevenueCat, setRevenueCatUserId } from "@/services/purchases/revenuecat";
import { clearAllMemos } from "@/services/storage/memo-storage";
import { useSettingsStore } from "@/store/settings-store";
import type { AuthUser, EmailLoginParams, EmailSignUpParams, SocialProvider } from "@/types/auth";

type AuthStoreState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  /** AsyncStorageからユーザー情報を復元し、セッションを検証する */
  initialize: () => Promise<void>;

  /** メールでログイン */
  loginWithEmail: (params: EmailLoginParams) => Promise<boolean>;

  /** メールで新規登録 */
  registerWithEmail: (params: EmailSignUpParams) => Promise<boolean>;

  /** ソーシャルログイン */
  loginWithSocial: (provider: SocialProvider) => Promise<boolean>;

  /** ログアウト */
  logout: () => Promise<void>;

  /** エラーをクリア */
  clearError: () => void;
};

/** 認証ストア */
export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      initialize: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true });
        try {
          const user = await getStoredUser();
          if (!user) {
            set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
            return;
          }

          // サーバーでセッションを検証（保存済みトークンを使用）
          const client = getAuthClient();
          if (client) {
            const sessionToken = await getStoredSessionToken();
            const session = await client.getSession(sessionToken ?? undefined);
            if (!session) {
              // セッションが無効 → ローカル認証状態をクリア
              await authSignOut();
              set({ user: null, isAuthenticated: false, isLoading: false, isInitialized: true });
              logger.info("セッション無効のため認証状態をクリア");
              return;
            }
          }

          // RevenueCatにユーザーIDを設定
          await setRevenueCatUserId(user.id);

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "auth.restoreFailed");
          set({ isLoading: false, isInitialized: true, error: message });
          logger.error("認証初期化エラー", { error: message });
        }
      },

      loginWithEmail: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const user = await signInWithEmail(params);
          if (!user) {
            set({
              isLoading: false,
              error: t(useSettingsStore.getState().locale, "auth.loginFailed"),
            });
            return false;
          }
          await setRevenueCatUserId(user.id);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "auth.loginFailed");
          set({ isLoading: false, error: message });
          return false;
        }
      },

      registerWithEmail: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const user = await signUpWithEmail(params);
          if (!user) {
            set({
              isLoading: false,
              error: t(useSettingsStore.getState().locale, "auth.signupFailed"),
            });
            return false;
          }
          await setRevenueCatUserId(user.id);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "auth.signupFailed");
          set({ isLoading: false, error: message });
          return false;
        }
      },

      loginWithSocial: async (provider) => {
        set({ isLoading: true, error: null });
        try {
          const user = await signInWithSocial(provider);
          if (!user) {
            set({
              isLoading: false,
              error: t(useSettingsStore.getState().locale, "auth.socialLoginFailed"),
            });
            return false;
          }
          await setRevenueCatUserId(user.id);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "auth.socialLoginFailed");
          set({ isLoading: false, error: message });
          return false;
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          await logOutRevenueCat();
          await authSignOut();
          // ログアウト時にローカルのメモ・翻訳履歴を削除（プライバシー保護）
          await clearAllMemos().catch((e) =>
            logger.warn("ログアウト時のメモ削除に失敗", {
              error: e instanceof Error ? e.message : String(e),
            }),
          );
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(useSettingsStore.getState().locale, "auth.logoutFailed");
          set({ isLoading: false, error: message });
          logger.error("ログアウトエラー", { error: message });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "translator-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
