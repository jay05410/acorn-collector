import type { LocaleMessages } from '../../define';

/**
 * AI connection settings (ACORN-7): provider cards, API keys and the
 * OpenRouter sign-in. Provider brand names are not translated and are passed
 * in as {provider}.
 */
export default {
  providerGroup: 'AIサービス',
  providerCli: 'ローカルCLI',
  recommended: 'おすすめ',
  advanced: '上級者向け',
  statusReady: '利用可能',
  statusNotConnected: '未接続',
  statusSetup: '要設定',
  statusCheckKey: 'キーを確認',
  descOpenrouter:
    'ワンクリックでサインイン。多数のモデルを使った分だけクレジットで支払えます。',
  descOpenai: 'ご自身のOpenAI APIキーを使います。',
  descAnthropic: 'Claudeを使うために、ご自身のAnthropic APIキーを使います。',
  descCli:
    'このパソコンでサインイン済みの Claude Code または Codex CLI を使います。',
  speedOpenrouter: '速度はモデルによって異なります',
  speedOpenai: '計測では画像1枚あたり約2-4秒',
  speedCli: '低速: 画像1枚あたり約10秒',
  defaultModel: '既定のモデル: {model}',
  costOpenrouter: 'OpenRouterのクレジットを使用',
  costOpenai: 'ご自身のOpenAIアカウントに請求',
  costAnthropic: 'ご自身のAnthropicアカウントに請求',
  costCli: 'APIキー不要、CLIのプランで実行',
  summaryNone:
    'AIサービスが接続されていません。ブースや商品は手入力でも追加できます。',
  summaryReady: '準備完了です。{provider} で分析します。',
  summaryNotReady:
    '{provider} の設定が完了していません。下の手順を済ませると画像を分析できます。',
  summaryKeyRejected:
    '{provider} が保存済みのキーを受け付けませんでした。下でキーを確認するか、差し替えてください。',
  keyLabel: '{provider} APIキー',
  keyHint: 'このブラウザ内にのみ保存され、{provider} にだけ送信されます。',
  keySaved: '保存済みのキー (末尾 {last4})',
  changeKey: '変更',
  removeKey: '削除',
  saveKey: 'キーを保存',
  showKey: 'キーを表示',
  hideKey: 'キーを隠す',
  keyRequired: '先にキーを入力してください。',
  keySavedToast: 'キーを保存しました。',
  keyRemovedToast: 'キーを削除しました。',
  getKey: 'APIキーを取得',
  testConnection: '接続テスト',
  testOk: '接続できました。{provider} がキーを確認しました。',
  testFailed: '接続に失敗しました',
  errAuth:
    'キーが拒否されました。キー全体をコピーしたか、まだ有効なキーかを確認してください。',
  errQuota: 'アカウントのクレジットが不足しているか、利用上限に達しています。',
  errRateLimit:
    '現在リクエストが多すぎます。少し待ってからもう一度お試しください。',
  errNetwork:
    '{provider} に接続できません。インターネット接続を確認してください。',
  errTimeout:
    '{provider} の応答に時間がかかりすぎています。もう一度お試しください。',
  errUnavailable:
    '{provider} は一時的に利用できません。しばらくしてからお試しください。',
  errUnknown: '問題が発生しました。もう一度お試しください。',
  orIntro:
    'OpenRouterにサインインして、この拡張機能用のキーを承認してください。キーはご自身のOpenRouterアカウントに属し、このブラウザ内にのみ保存されます。',
  orConnect: 'OpenRouterで接続',
  orUseCode: 'コードで接続する',
  orPasteKey: '既存のキーを貼り付ける',
  orRedirectFailed:
    'サインインが完了しませんでした。もう一度試すか、コードで接続してください。',
  orCodeTitle: 'コードで接続',
  orCodeStep1: '開いたOpenRouterのタブでアクセスを承認してください。',
  orCodeReopen: 'OpenRouterをもう一度開く',
  orCodeStep2:
    'OpenRouterに表示されたコード(またはそのページのアドレス)をコピーして、ここに貼り付けてください。',
  orCodeLabel: 'OpenRouterのコード',
  orCodeSubmit: '接続',
  orCodeInvalid:
    'OpenRouterのコードではないようです。コードまたはページのアドレス全体を貼り付けてください。',
  orCodeRejected:
    'OpenRouterがコードを受け付けませんでした。コードは1回限りで10分後に失効するため、最初からやり直して新しいコードを取得してください。',
  orStartOver: '最初からやり直す',
  orManualTitle: '既存のキーを貼り付ける',
  orConnectedOauth: 'OpenRouterのサインインで接続済み',
  orConnectedManual: '貼り付けたキーで接続済み',
  orKeyName: 'キーの名前',
  orLimit: 'クレジット上限',
  orNoLimit: '上限なし',
  orRemaining: '残り',
  orUsage: 'これまでの使用量',
  orResets: '上限のリセット',
  resetDaily: '毎日',
  resetWeekly: '毎週',
  resetMonthly: '毎月',
  orFreeTier: '無料枠',
  orKeyInfoFailed: 'キーのクレジット情報を読み込めませんでした。',
  orKeyInvalid:
    'このキーはもう使えません。接続を解除してから、もう一度接続してください。',
  orSaveFailed:
    'OpenRouterでキーが作成されましたが、このブラウザに保存できませんでした。このページを離れる前にもう一度保存してください。離れると接続し直す必要があります。',
  orRetrySave: 'もう一度保存',
  orCodeStartFailed:
    'コードでの接続を開始できませんでした。もう一度試すか、キーを貼り付けてください。',
  orManage: 'OpenRouterでキーを管理',
  refresh: '更新',
  disconnect: '接続を解除',
  connectedToast: '{provider} に接続しました。',
  disconnectedToast:
    '{provider} の接続を解除しました。キーは {provider} のアカウントに残っています。',
} satisfies LocaleMessages['aiConnect'];
