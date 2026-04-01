import type { QuotaPack } from "@/types/quota";

/** 初期付与クォータ数 */
export const INITIAL_QUOTA = 20;

/** 広告視聴報酬クォータ数 */
export const AD_REWARD_QUOTA = 5;

/** 音声認識消費クォータ */
export const TRANSCRIBE_COST = 1;

/** 翻訳消費クォータ */
export const TRANSLATE_COST = 1;

/** クォータ残高警告しきい値 */
export const QUOTA_LOW_THRESHOLD = 10;

/** 課金パック一覧 */
export const QUOTA_PACKS: QuotaPack[] = [
  {
    type: "starter",
    amount: 100,
    price: "¥160",
    priceNum: 160,
    label: "Starter",
  },
  {
    type: "standard",
    amount: 500,
    price: "¥650",
    priceNum: 650,
    label: "Standard",
  },
  {
    type: "premium",
    amount: 1500,
    price: "¥1,600",
    priceNum: 1600,
    label: "Premium",
  },
];
