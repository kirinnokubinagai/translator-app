# Talkable (translator-app)

## 概要
対面会話・リアルタイム字幕・音声メモの3機能を持つ即時通訳アプリ。

## Tech Stack
- **Framework**: Expo (React Native) + TypeScript + Expo Router
- **STT**: 独自 Faster Whisper worker (RunPod Serverless, large-v3-turbo, int8_float16)
- **Translation**: 独自 TranslateGemma worker (RunPod Serverless, 4B model)
- **TTS**: expo-speech
- **API Proxy**: Cloudflare Workers + Turso (SQLite)
- **Auth**: Better Auth (email + Apple Sign In)
- **UI**: NativeWind (Tailwind CSS) + Lucide React Native
- **State**: Zustand + AsyncStorage (persist)
- **Monetization**: RevenueCat (IAP) + AdMob (rewarded ads)
- **Validation**: Zod
- **Lint/Format**: Biome
- **Git Hooks**: Husky + lint-staged
- **CI**: GitHub Actions (typecheck + biome + test)
- **E2E**: Maestro (ローカル手動実行)

## コマンド
```bash
# App
npm start          # Expo開発サーバー
npm run typecheck  # 型チェック
npm run check      # Biome lint + format + import整理
npm run check:fix  # 上記 + 自動修正
npm test           # Jest単体テスト

# Worker
cd worker && npm run typecheck  # Worker型チェック
cd worker && npm test           # Workerテスト

# E2E
maestro test maestro/run_all.yaml
```

## プロジェクト構造
```
app/                    # Expo Router画面
  (tabs)/               # タブ画面 (conversation, subtitles, memo, history)
  login.tsx / signup.tsx # 認証画面
  settings.tsx          # 設定
  quota.tsx             # クォータ管理
  diagnostic.tsx        # 診断
  memo/[id].tsx         # メモ詳細
src/
  components/ui/        # 共通UIコンポーネント
  components/quota/     # クォータ関連UI
  services/api/         # APIクライアント (transcribe, translate, warmup, quota, device)
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
  src/index.ts          # メインハンドラー
  src/auth.ts           # Better Auth設定
  src/quota.ts          # クォータ管理
  src/schema.ts         # DBスキーマ
  src/metrics.ts        # メトリクス収集
runpod-worker/          # TranslateGemma Docker worker
whisper-worker/         # Faster Whisper Docker worker
maestro/                # Maestro E2Eテストフロー
modules/                # Expo ネイティブモジュール (device-attestation)
```

## 環境変数
`.env.example`を参照。`EXPO_PUBLIC_`プレフィックス必須。

## Worker シークレット
`wrangler secret put <KEY>` で設定:
- `RUNPOD_API_KEY`, `RUNPOD_WHISPER_ENDPOINT_ID`, `RUNPOD_TRANSLATE_ENDPOINT_ID`
- `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`
- `BETTER_AUTH_SECRET`, `APP_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `REVENUECAT_API_KEY`

## アーキテクチャ
```
Mobile App → Cloudflare Worker (HMAC署名) → RunPod Whisper / TranslateGemma
                 ↕
              Turso DB (auth, quota, rate limits, metrics)
```

### 起動フロー
1. fire-and-forget warmup → RunPodコールドスタート開始
2. 無料ユーザー → 広告表示 (クォータ付与) → 会話画面
3. 有料ユーザー → ローディング → 会話画面

### セキュリティ
- 機密情報は SecureStore に保存（本番で AsyncStorage フォールバック禁止）
- API リクエストは HMAC 署名付き
- デバイス登録時に PBKDF2 ハッシュ + 構成証明

## 品質ゲート
- **pre-commit**: lint-staged (Biome check)
- **pre-push**: typecheck + biome check + test
- **CI**: typecheck + biome check + test (App + Worker)

## コーディング規約
- TypeScript strict mode
- `any`型禁止 → `unknown` + type guard
- `else`禁止 → 早期リターン
- 日本語JSDoc, 日本語エラーメッセージ
- Lucide Iconsを使用（絵文字禁止）
- マジックナンバー禁止 → 定数化
- ハードコード禁止（URL, トークン, シークレット → 環境変数/wrangler secret）
