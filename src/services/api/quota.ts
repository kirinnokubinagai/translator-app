import { API_BASE_URL } from "@/constants/api";
import type {
  QuotaAddResponse,
  QuotaBalanceResponse,
  QuotaInitResponse,
  QuotaPackType,
  QuotaPurchaseResponse,
} from "@/types/quota";
import { apiRequest } from "./client";
import { getAuthHeaders } from "./headers";

/** サーバー発行のnonce（広告表示前に取得） */
let pendingAdNonce: string | null = null;

/** サーバー発行nonceレスポンス */
type AdNonceResponse = {
  success: boolean;
  data?: { nonce: string };
};

/**
 * サーバーから広告用nonceを取得して保持する
 *
 * 広告表示前にサーバーでnonceを発行させる。
 * サーバー発行nonceにより、広告を実際に視聴したことの検証を強化する。
 *
 * @returns 取得成功時はtrue
 */
export async function requestAdNonce(): Promise<boolean> {
  try {
    const requestUrl = `${API_BASE_URL}/api/quota/ad-nonce`;
    const headers = await getAuthHeaders("POST", requestUrl);
    const response = await apiRequest<AdNonceResponse>(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      retries: 1,
    });
    if (response.success && response.data?.nonce) {
      pendingAdNonce = response.data.nonce;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 保持中のサーバー発行nonceを取得してクリアする
 *
 * @returns nonce（未設定時はnull）
 */
export function consumeAdNonce(): string | null {
  const nonce = pendingAdNonce;
  pendingAdNonce = null;
  return nonce;
}

/**
 * クォータ初期化（初回起動時）
 */
export async function initQuota(): Promise<QuotaInitResponse> {
  const requestUrl = `${API_BASE_URL}/api/quota/init`;
  const headers = await getAuthHeaders("POST", requestUrl);
  return apiRequest<QuotaInitResponse>(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
    retries: 2,
  });
}

/**
 * クォータ残高取得
 */
export async function fetchQuotaBalance(): Promise<QuotaBalanceResponse> {
  const requestUrl = `${API_BASE_URL}/api/quota`;
  const headers = await getAuthHeaders("GET", requestUrl);
  return apiRequest<QuotaBalanceResponse>(requestUrl, {
    method: "GET",
    headers,
    retries: 1,
  });
}

/**
 * 広告視聴によるクォータ追加（nonce付き）
 *
 * @param nonce - 広告表示前に生成したnonce（リプレイ攻撃防止）
 */
export async function addQuotaByAd(nonce: string): Promise<QuotaAddResponse> {
  const requestUrl = `${API_BASE_URL}/api/quota/add`;
  const headers = await getAuthHeaders("POST", requestUrl);
  return apiRequest<QuotaAddResponse>(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "ad_reward", nonce }),
    retries: 1,
  });
}

/**
 * 課金パック購入によるクォータ追加
 *
 * @param pack - パック種別
 * @param transactionId - RevenueCatトランザクションID（重複チェック・検証用）
 * @param productId - ストアのプロダクトID（RevenueCat API検証用）
 * @param appUserId - RevenueCatのsubscriber ID（購入検証用）
 */
export async function purchaseQuota(
  pack: QuotaPackType,
  transactionId: string,
  productId?: string,
  appUserId?: string,
): Promise<QuotaPurchaseResponse> {
  const requestUrl = `${API_BASE_URL}/api/quota/purchase`;
  const headers = await getAuthHeaders("POST", requestUrl);
  return apiRequest<QuotaPurchaseResponse>(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      packId: pack,
      receiptToken: transactionId,
      appUserId,
      productId: productId ?? pack,
    }),
    retries: 1,
  });
}
