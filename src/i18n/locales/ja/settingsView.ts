import type { LocaleMessages } from '../../define';

/** The settings screen (ACORN-7): sections other than the AI connection. */
export default {
  saveFailed: '変更を保存できませんでした。もう一度お試しください。',
  sectionAi: 'AI接続',
  sectionAiDesc:
    'ブース画像や投稿を読み取るAIサービスを選びます。ご自身のアカウントに直接つながり、当方のサーバーは経由しません。',
  sectionAnalysis: '分析',
  sectionAnalysisDesc: '速度、モデル、分析を始めるタイミングを設定します。',
  sectionAppearance: '表示',
  sectionData: 'データ',
  sectionAbout: 'このアプリについて',
  tierLabel: 'モード',
  tierFast: '高速',
  tierAccurate: '高精度',
  tierFastHint:
    'いちばん早く結果が出ます。見やすい価格表や文字の多い画像向けです。',
  tierAccurateHint:
    '時間はかかりますが高性能です。写真、手書き、込み入ったレイアウト向けです。',
  tierUsesModel: '{model} を使用します。',
  modelLabel: 'モデル',
  modelDefault: 'このモードの既定 ({model})',
  modelCustom: 'モデルIDを入力...',
  modelCustomLabel: 'モデルID',
  modelCustomHint:
    '画像に対応したモデルを指定してください。両方のモードで既定のモデルの代わりに使われます。',
  modelOverrideHint: '両方のモードで既定のモデルの代わりに使われます。',
  modelNeedsProvider:
    'モデルを選ぶには、先に上でAIサービスを選択してください。',
  cliModelLabel: 'CLIモデル',
  cliModelHintDefault: '空欄のままにすると {model} を使用します。',
  cliModelHintCodex: '空欄のままにすると Codex の既定モデルを使用します。',
  cliModelForeign:
    '「{model}」は {cli} のモデルではないため、既定のモデルを使用します。',
  autoAnalyzeLabel: 'キャプチャ後に自動で分析',
  autoAnalyzeHint:
    '投稿をキャプチャするとすぐにAI分析を始めます。先に内容を確認したい場合はオフにしてください。',
  cacheLabel: '保存された分析結果',
  cacheHint:
    '同じ画像をもう一度分析すると、前回の結果をすぐに再利用します。このブラウザ内にのみ保存されます。',
  clearCache: '消去',
  clearCacheTitle: '保存された分析結果を消去しますか？',
  clearCacheBody:
    'ブースと商品はそのまま残ります。次に画像を分析するときは、AIサービスを再度呼び出します。',
  clearCacheConfirm: '結果を消去',
  cacheCleared_one: '保存された結果を{count}件削除しました。',
  cacheCleared_other: '保存された結果を{count}件削除しました。',
  cacheClearFailed:
    '保存された結果を消去できませんでした。もう一度お試しください。',
  darkModeNote: 'ダークモードはブラウザまたはシステムの設定に従います。',
  dataIntro:
    'イベント、ブース、商品はこのブラウザ内にのみ保存されます。拡張機能を削除すると一緒に消えるため、ときどきバックアップを書き出してください。',
  exportDone: 'バックアップファイルをダウンロードしました。',
  version: 'バージョン',
  sourceCode: 'ソースコード',
  noServers:
    'アカウントは不要です。保存した内容はブラウザ内に残り、当方のサーバーには何も保存されません。',
} satisfies LocaleMessages['settingsView'];
