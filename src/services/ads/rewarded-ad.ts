import { logger } from "@/lib/logger";

/** 広告SDKの動的インポート結果 */
let AdModule: typeof import("react-native-google-mobile-ads") | null = null;
/** リワード広告インスタンス */
let rewardedAd: unknown = null;
/** 広告ロード済みフラグ */
let isAdLoaded = false;
/** SDK初期化済みフラグ */
let sdkAvailable = false;
/** 前回のリスナー解除関数 */
let cleanupListeners: (() => void) | null = null;
/** 広告準備状態の購読者 */
const readyListeners = new Set<(ready: boolean) => void>();

function setAdReady(ready: boolean): void {
  isAdLoaded = ready;
  readyListeners.forEach((listener) => listener(ready));
}

/**
 * AdMob SDKを安全に読み込む（未設定時はスキップ）
 */
async function ensureAdModule(): Promise<boolean> {
  if (sdkAvailable) return true;
  if (AdModule === null) {
    try {
      AdModule = await import("react-native-google-mobile-ads");
      sdkAvailable = true;
    } catch (error) {
      logger.warn("AdMob SDKの読み込みに失敗しました（広告機能は無効）", {
        error: error instanceof Error ? error.message : String(error),
      });
      AdModule = null;
      sdkAvailable = false;
      return false;
    }
  }
  return sdkAvailable;
}

/**
 * リワード広告をプリロード
 */
export async function preloadRewardedAd(): Promise<void> {
  const available = await ensureAdModule();
  if (!available || !AdModule) return;

  try {
    // 前回のリスナーを解除してリーク防止
    if (cleanupListeners) {
      cleanupListeners();
      cleanupListeners = null;
    }

    setAdReady(false);

    const adUnitId = __DEV__
      ? AdModule.TestIds.REWARDED
      : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID ?? AdModule.TestIds.REWARDED);

    const ad = AdModule.RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubLoaded = ad.addAdEventListener(AdModule.RewardedAdEventType.LOADED, () => {
      setAdReady(true);
      logger.debug("リワード広告ロード完了");
    });

    const unsubError = ad.addAdEventListener(AdModule.AdEventType.ERROR, (error) => {
      setAdReady(false);
      logger.warn("リワード広告ロードエラー", { error: String(error) });
    });

    cleanupListeners = () => {
      unsubLoaded();
      unsubError();
    };

    rewardedAd = ad;
    ad.load();
  } catch (error) {
    logger.warn("リワード広告プリロード失敗", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * リワード広告を表示し、報酬獲得を待つ
 *
 * @returns 報酬獲得成功時はtrue、失敗/キャンセル時はfalse
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!sdkAvailable || !AdModule || !rewardedAd || !isAdLoaded) {
    logger.warn("広告が準備できていません");
    preloadRewardedAd();
    return false;
  }

  return new Promise((resolve) => {
    const ad = rewardedAd as { addAdEventListener: (type: string, cb: () => void) => () => void; show: () => void };
    let rewarded = false;

    const earnedListener = ad.addAdEventListener(
      AdModule!.RewardedAdEventType.EARNED_REWARD,
      () => {
        rewarded = true;
        logger.info("リワード広告報酬獲得");
      }
    );

    const closedListener = ad.addAdEventListener(
      AdModule!.AdEventType.CLOSED,
      () => {
        earnedListener();
        closedListener();
        setAdReady(false);
        preloadRewardedAd();
        resolve(rewarded);
      }
    );

    ad.show();
  });
}

/**
 * 広告が表示可能か
 */
export function isRewardedAdReady(): boolean {
  return isAdLoaded;
}

export function subscribeRewardedAdReady(
  listener: (ready: boolean) => void
): () => void {
  readyListeners.add(listener);
  listener(isAdLoaded);
  return () => {
    readyListeners.delete(listener);
  };
}
