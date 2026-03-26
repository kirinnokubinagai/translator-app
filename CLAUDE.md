# 即時通訳アプリ (Translator App)

## 概要
対面会話・リアルタイム字幕・音声メモの3機能を持つ即時通訳iOSアプリ。

## Tech Stack
- **Framework**: Expo (React Native) + TypeScript + Expo Router
- **STT**: RunPod + Faster Whisper (serverless endpoint)
- **Translation**: OpenAI GPT-4o-mini
- **TTS**: expo-speech
- **UI**: NativeWind (Tailwind CSS) + Lucide React Native
- **State**: Zustand + AsyncStorage (persist)
- **Validation**: Zod

## コマンド
```bash
npm start        # Expo開発サーバー起動
npm run ios      # iOS起動
npm run android  # Android起動
npx tsc --noEmit # 型チェック
```

## プロジェクト構造
```
app/              # Expo Router画面
  (tabs)/         # タブ画面 (conversation, subtitles, memo, history)
  settings.tsx    # 設定画面
  memo/[id].tsx   # メモ詳細
src/
  components/ui/  # 共通UIコンポーネント
  services/api/   # RunPod STT, OpenAI翻訳, TTS
  services/audio/ # 録音, チャンク分割
  services/storage/ # AsyncStorage永続化
  hooks/          # カスタムフック
  store/          # Zustandストア
  types/          # 型定義
  constants/      # 定数
  i18n/           # 多言語リソース
  lib/            # エラー, ロガー
```

## 環境変数
`.env.example`を参照。`EXPO_PUBLIC_`プレフィックス必須。

## コーディング規約
- TypeScript strict mode
- `any`型禁止 → `unknown` + type guard
- `else`禁止 → 早期リターン
- 日本語JSDoc, 日本語エラーメッセージ
- Lucide Iconsを使用（絵文字禁止）
- マジックナンバー禁止 → 定数化
