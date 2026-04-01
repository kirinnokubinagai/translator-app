/** クォータ残高データ */
export type QuotaBalance = {
  balance: number;
  totalPurchased: number;
  totalEarnedByAd: number;
  totalConsumed: number;
};

/** クォータ初期化レスポンス */
export type QuotaInitResponse = {
  success: true;
  data: {
    balance: number;
    isNew: boolean;
  };
};

/** クォータ残高レスポンス */
export type QuotaBalanceResponse = {
  success: true;
  data: QuotaBalance;
};

/** クォータ追加レスポンス */
export type QuotaAddResponse = {
  success: true;
  data: {
    balance: number;
    added: number;
  };
};

/** クォータ購入レスポンス */
export type QuotaPurchaseResponse = {
  success: true;
  data: {
    balance: number;
    added: number;
    pack: QuotaPackType;
  };
};

/** 課金パック種別 */
export type QuotaPackType = "starter" | "standard" | "premium";

/** 課金パック情報 */
export type QuotaPack = {
  type: QuotaPackType;
  amount: number;
  price: string;
  priceNum: number;
  label: string;
};
