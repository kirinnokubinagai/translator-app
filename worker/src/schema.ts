/**
 * Drizzle ORM スキーマ定義（Better Auth + クォータ管理）
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** ユーザーテーブル（Better Auth） */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

/** セッションテーブル（Better Auth） */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

/** アカウントテーブル（Better Auth） */
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: text("access_token_expires_at"),
  refreshTokenExpiresAt: text("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

/** 検証テーブル（Better Auth） */
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

/** クォータ残高テーブル */
export const quotas = sqliteTable("quotas", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  totalPurchased: integer("total_purchased").notNull().default(0),
  totalEarnedByAd: integer("total_earned_by_ad").notNull().default(0),
  totalConsumed: integer("total_consumed").notNull().default(0),
  adRewardCount: integer("ad_reward_count").notNull().default(0),
  adRewardDate: text("ad_reward_date").notNull().default(""),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

/** クォータ履歴テーブル */
export const purchaseHistory = sqliteTable("purchase_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  receiptToken: text("receipt_token"),
  packId: text("pack_id"),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  createdAt: text("created_at"),
});
