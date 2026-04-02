# Talkable

対面会話・リアルタイム字幕・音声メモの3機能を持つ即時通訳アプリ。

## Tech Stack

| レイヤー | 技術 |
|---------|------|
| App | Expo (React Native) + TypeScript + Expo Router |
| UI | NativeWind (Tailwind CSS) + Lucide React Native |
| State | Zustand + AsyncStorage (persist) |
| STT | 独自 Faster Whisper worker (RunPod Serverless) |
| Translation | 独自 TranslateGemma worker (RunPod Serverless) |
| TTS | expo-speech |
| API Proxy | Cloudflare Workers + Turso (SQLite) |
| Auth | Better Auth (email + Apple Sign In) |
| Monetization | RevenueCat (IAP) + AdMob (rewarded ads) |
| Validation | Zod |
| Lint/Format | Biome |
| Git Hooks | Husky + lint-staged |
| CI | GitHub Actions |
| E2E | Maestro |

## Getting Started

### 前提条件

- Node.js 20+
- Expo CLI (`npx expo`)
- iOS Simulator or Android Emulator (Development Build)

### セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数を設定
cp .env.example .env
# .env を編集して値を入力

# Expo開発サーバー起動
npm start
```

### 環境変数 (`.env`)

```bash
# Cloudflare Worker プロキシURL
EXPO_PUBLIC_API_URL=

# RevenueCat APIキー
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=

# AdMob リワード広告ユニットID（省略時はテストIDを使用）
EXPO_PUBLIC_ADMOB_REWARDED_ID=

# 認証サーバーURL（Better Auth）
EXPO_PUBLIC_AUTH_URL=
```

## コマンド

### App

```bash
npm start          # Expo開発サーバー
npm run ios        # iOS起動
npm run android    # Android起動
npm run typecheck  # TypeScript型チェック
npm run lint       # Biome lint
npm run format     # Biome format
npm run check      # Biome lint + format + import整理
npm run check:fix  # 上記 + 自動修正
npm test           # Jest単体テスト
npm run test:all   # 全テスト（worker含まず）
```

### Worker (Cloudflare Workers API)

```bash
cd worker
npm install
npm run typecheck  # TypeScript型チェック
npm test           # Jest単体テスト
npx wrangler dev   # ローカル開発サーバー
npx wrangler deploy # デプロイ
```

### Maestro E2E

```bash
maestro test maestro/run_all.yaml    # 全フロー実行
maestro test maestro/01_login_screen.yaml  # 個別フロー
```

## アーキテクチャ

```
Mobile App (Expo)
  |
  | HTTPS (HMAC署名)
  v
Cloudflare Worker (API Proxy)
  |
  |--- Turso DB (auth, quota, rate limits, metrics)
  |
  |--- RunPod Serverless: Faster Whisper (STT)
  |      Docker: whisper-worker/ (large-v3-turbo, int8_float16)
  |
  |--- RunPod Serverless: TranslateGemma (Translation)
         Docker: runpod-worker/ (4B model)
```

### 起動フロー

1. `_layout.tsx`: fire-and-forget warmup (RunPodコールドスタート開始)
2. `index.tsx`: ストアhydration + セッション検証
3. 無料ユーザー: リワード広告表示 (クォータ付与) → 会話画面
4. 有料ユーザー: ローディング → 会話画面

### クォータシステム

- 初回登録: 無料クォータ付与
- 音声認識: 1クォータ/リクエスト
- 翻訳: 1クォータ/リクエスト
- 補充: 広告視聴 or IAP課金パック (starter/standard/premium)

## プロジェクト構造

```
app/                    # Expo Router画面
  (tabs)/               # タブ画面 (conversation, subtitles, memo, history)
  login.tsx             # ログイン
  signup.tsx            # サインアップ
  settings.tsx          # 設定
  quota.tsx             # クォータ管理
  diagnostic.tsx        # 診断
  memo/[id].tsx         # メモ詳細
src/
  components/ui/        # 共通UIコンポーネント
  components/quota/     # クォータ関連UI
  services/api/         # API クライアント (transcribe, translate, warmup, quota, device)
  services/audio/       # 録音
  services/auth/        # Better Auth クライアント
  services/ads/         # AdMob リワード広告
  services/purchases/   # RevenueCat IAP
  services/attestation/ # デバイス構成証明
  services/storage/     # AsyncStorage永続化
  hooks/                # カスタムフック
  store/                # Zustandストア (auth, quota, conversation, settings, memo)
  types/                # 型定義
  constants/            # 定数
  i18n/                 # 多言語リソース (ja, en)
  lib/                  # エラー, ロガー, デバイスID
worker/                 # Cloudflare Workers API
  src/index.ts          # メインハンドラー (auth, quota, proxy, rate limit, metrics)
  src/auth.ts           # Better Auth設定
  src/quota.ts          # クォータ管理
  src/schema.ts         # DBスキーマ
  src/metrics.ts        # メトリクス収集
runpod-worker/          # TranslateGemma Docker worker
whisper-worker/         # Faster Whisper Docker worker
maestro/                # Maestro E2Eテストフロー
modules/                # Expo ネイティブモジュール (device-attestation)
```

## デプロイ

### Cloudflare Worker

```bash
cd worker

# シークレット設定（初回のみ）
npx wrangler secret put RUNPOD_API_KEY
npx wrangler secret put RUNPOD_WHISPER_ENDPOINT_ID
npx wrangler secret put RUNPOD_TRANSLATE_ENDPOINT_ID
npx wrangler secret put TURSO_DB_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put REVENUECAT_API_KEY
npx wrangler secret put APP_SECRET

# デプロイ
npx wrangler deploy
```

### RunPod Serverless

1. GitHub Actionsが `whisper-worker/` or `runpod-worker/` 変更時にDockerイメージをGHCRにpush
2. RunPodで Serverless Endpoint を作成:
   - Whisper: `ghcr.io/<owner>/whisper-worker:latest` / GPU: T4 / min workers: 0
   - TranslateGemma: `ghcr.io/<owner>/translategemma-worker:4b` / GPU: T4 / min workers: 0
   - Network Volume: `/runpod-volume` にマウント
3. Endpoint IDをCloudflare Workerシークレットに設定

### アプリ (EAS Build)

```bash
# Development Build
eas build --profile development --platform ios

# Production Build
eas build --profile production --platform ios
eas submit --platform ios
```

## 品質ゲート

### ローカル (Husky)

- **pre-commit**: `lint-staged` (Biome check on staged files)
- **pre-push**: `typecheck` + `biome check` + `test`

### CI (GitHub Actions)

- **App**: typecheck + biome check + test
- **Worker**: typecheck + test
- **Docker**: whisper-worker / runpod-worker ビルド (パス変更時のみ)

## ライセンス

Private
