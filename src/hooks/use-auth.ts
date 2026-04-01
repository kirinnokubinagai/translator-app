import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { EmailLoginParams, EmailSignUpParams, SocialProvider } from "@/types/auth";

/**
 * 認証管理フック
 */
export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    initialize,
    loginWithEmail,
    registerWithEmail,
    loginWithSocial,
    logout,
    clearError,
  } = useAuthStore();

  useEffect(() => {
    if (isInitialized) return;
    initialize();
  }, [initialize, isInitialized]);

  /** メールログイン */
  const handleLoginWithEmail = useCallback(
    async (params: EmailLoginParams): Promise<boolean> => {
      return loginWithEmail(params);
    },
    [loginWithEmail]
  );

  /** メール新規登録 */
  const handleRegisterWithEmail = useCallback(
    async (params: EmailSignUpParams): Promise<boolean> => {
      return registerWithEmail(params);
    },
    [registerWithEmail]
  );

  /** ソーシャルログイン */
  const handleLoginWithSocial = useCallback(
    async (provider: SocialProvider): Promise<boolean> => {
      return loginWithSocial(provider);
    },
    [loginWithSocial]
  );

  /** ログアウト */
  const handleLogout = useCallback(async (): Promise<void> => {
    await logout();
  }, [logout]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    loginWithEmail: handleLoginWithEmail,
    registerWithEmail: handleRegisterWithEmail,
    loginWithSocial: handleLoginWithSocial,
    logout: handleLogout,
    clearError,
  };
}
