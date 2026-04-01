import { useEffect, useCallback } from "react";
import { useQuotaStore } from "@/store/quota-store";
import { QUOTA_LOW_THRESHOLD, TRANSCRIBE_COST, TRANSLATE_COST } from "@/constants/quota";
import type { QuotaPackType } from "@/types/quota";

/**
 * クォータ管理フック
 */
export function useQuota() {
  const {
    balance,
    isInitialized,
    isLoading,
    error,
    initialize,
    syncBalance,
    earnByAd,
    purchase,
    deductLocal,
    clearError,
  } = useQuotaStore();

  useEffect(() => {
    // デバイス登録は app/_layout.tsx で実行され、成功時に initialize() を呼ぶ。
    // ここでは未初期化の場合のみフォールバックとして初期化する。
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  /** クォータ残高が低い */
  const isLow = balance <= QUOTA_LOW_THRESHOLD && balance > 0;

  /** クォータが空 */
  const isEmpty = balance <= 0;

  /** 1チャンクの合計コスト（STT + 翻訳） */
  const chunkCost = TRANSCRIBE_COST + TRANSLATE_COST;

  /** 音声認識可能か（開発環境では無制限） */
  const canTranscribe = __DEV__ || balance >= TRANSCRIBE_COST;

  /** 翻訳可能か（開発環境では無制限） */
  const canTranslate = __DEV__ || balance >= TRANSLATE_COST;

  /** 会話開始可能か（STT+翻訳の合計コストが必要） */
  const canStartConversation = __DEV__ || balance >= chunkCost;

  /** 音声認識前にクォータを楽観的に消費 */
  const consumeForTranscribe = useCallback(() => {
    deductLocal(TRANSCRIBE_COST);
  }, [deductLocal]);

  /** 翻訳前にクォータを楽観的に消費 */
  const consumeForTranslate = useCallback(() => {
    deductLocal(TRANSLATE_COST);
  }, [deductLocal]);

  /** 広告視聴でクォータ取得（nonce付き） */
  const watchAdForQuota = useCallback(async (nonce: string): Promise<boolean> => {
    return earnByAd(nonce);
  }, [earnByAd]);

  /** パック購入 */
  const purchasePack = useCallback(
    async (pack: QuotaPackType, transactionId: string, productId?: string, appUserId?: string): Promise<boolean> => {
      return purchase(pack, transactionId, productId, appUserId);
    },
    [purchase]
  );

  return {
    balance,
    isInitialized,
    isLoading,
    error,
    isLow,
    isEmpty,
    canTranscribe,
    canTranslate,
    canStartConversation,
    consumeForTranscribe,
    consumeForTranslate,
    watchAdForQuota,
    purchasePack,
    syncBalance,
    clearError,
  };
}
