import { Platform } from "react-native";
import { logger } from "@/lib/logger";

/** RevenueCat SDK動的インポート */
let Purchases: typeof import("react-native-purchases").default | null = null;
let sdkAvailable = false;

/**
 * RevenueCat SDKを初期化する
 * Development BuildでのみSDKが使える。Expo Goではスキップ。
 */
export async function initRevenueCat(): Promise<boolean> {
  if (sdkAvailable) return true;

  try {
    const mod = await import("react-native-purchases");
    Purchases = mod.default;

    const apiKey =
      Platform.OS === "ios"
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      logger.warn("RevenueCat APIキーが未設定");
      return false;
    }

    await Purchases.configure({ apiKey });
    sdkAvailable = true;
    logger.info("RevenueCat初期化完了");
    return true;
  } catch (err) {
    logger.warn("RevenueCat SDKが利用できません（Expo Go?）", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * 利用可能なパッケージ（課金プラン）を取得
 */
export async function getOfferings(): Promise<import("react-native-purchases").PurchasesPackage[]> {
  if (!Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) return [];
    return offerings.current.availablePackages;
  } catch (err) {
    logger.error("Offerings取得失敗", { error: String(err) });
    return [];
  }
}

/**
 * パッケージを購入する
 * Sandbox環境では無料で購入できる
 *
 * @returns 購入成功時はCustomerInfo、キャンセル時はnull
 */
export async function purchasePackage(
  pkg: import("react-native-purchases").PurchasesPackage,
): Promise<import("react-native-purchases").CustomerInfo | null> {
  if (!Purchases) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    logger.info("購入成功", { productId: pkg.product.identifier });
    return customerInfo;
  } catch (err) {
    const purchaseError = err as { userCancelled?: boolean };
    if (purchaseError.userCancelled) {
      logger.info("購入キャンセル");
      return null;
    }
    logger.error("購入失敗", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * RevenueCat の現在の appUserId を取得する
 *
 * ログイン済みの場合は user.id、未ログインの場合は RevenueCat が自動生成した匿名ID。
 * 購入検証時にサーバーに送信し、RevenueCat API の subscriber ID として使用する。
 */
export async function getRevenueCatAppUserId(): Promise<string | null> {
  if (!Purchases) return null;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

/**
 * 購入の復元
 */
export async function restorePurchases(): Promise<
  import("react-native-purchases").CustomerInfo | null
> {
  if (!Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (err) {
    logger.error("購入復元失敗", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * RevenueCat からログアウトする
 *
 * appUserID を匿名IDにリセットする。
 * アプリのログアウト時に呼び出し、前ユーザーの購入状態が残らないようにする。
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!Purchases) return;
  try {
    await Purchases.logOut();
    logger.info("RevenueCatログアウト完了");
  } catch (err) {
    logger.warn("RevenueCatログアウト失敗", { error: String(err) });
  }
}

/**
 * RevenueCatにユーザーIDを設定（ログイン連携）
 */
export async function setRevenueCatUserId(userId: string): Promise<void> {
  if (!Purchases) return;
  try {
    await Purchases.logIn(userId);
    logger.info("RevenueCatユーザーID設定", { userId });
  } catch (err) {
    logger.warn("RevenueCatログイン失敗", { error: String(err) });
  }
}
