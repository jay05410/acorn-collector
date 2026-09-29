import type { LocaleMessages } from '../../define';

/**
 * Local CLI bridge setup (ACORN-7). CLI names (Claude Code, Codex) and shell
 * commands are not translated; they arrive as {cli} or are shown verbatim.
 */
export default {
  intro:
    'このパソコンでサインイン済みの Claude Code または Codex CLI で分析するため、APIキーは不要です。',
  pointSlower: 'APIキー方式より低速です。画像1枚あたり約10秒かかります。',
  pointData:
    '画像と投稿テキストは、ご自身のアカウントとプランで Anthropic (Claude Code) または OpenAI (Codex) に送信されます。',
  pointAdvanced:
    '上級者向けです。Node.js 20以上と、1回だけのインストールが必要です。',
  policyNote:
    'ご利用のプランの規約がこの使い方を認めているか確認してください。不明な場合はAPIキー方式をお使いください。',
  targetLabel: '使用するCLI',
  permissionTitle: 'ネイティブメッセージングを許可',
  permissionBody:
    '拡張機能がこのパソコン上の小さなヘルパープログラムと通信できるようにします。Chromeが確認を求めます。',
  permissionAllow: '許可',
  permissionGranted: '許可済み',
  permissionDenied:
    '権限が許可されませんでした。もう一度試すには「許可」を選んでください。',
  installTitle: 'ヘルパーをインストール',
  installBody:
    'ソースコードをダウンロードし、native-host フォルダをターミナルで開いて次を実行します:',
  installAfter: 'その後、ブラウザを再起動してください。',
  extensionId: '拡張機能ID',
  copy: 'コマンドをコピー',
  copied: 'コピーしました',
  copyFailed:
    'コピーできませんでした。コマンドを選択して手動でコピーしてください。',
  guide: 'インストール手順',
  statusTitle: '接続を確認',
  check: '確認',
  checkAgain: 'もう一度確認',
  checking: 'ヘルパーを確認しています...',
  inUse: '使用中',
  installed: 'インストール済み',
  notInstalled: '未インストール',
  signedIn: 'サインイン済み',
  signedInDetails: 'サインイン済み ({details})',
  notSignedIn: '未サインイン',
  hintInstallClaude:
    'Claude Code をインストールしてから、インストーラーをもう一度実行してください。',
  hintInstallCodex:
    'Codex をインストールしてから、インストーラーをもう一度実行してください。',
  hintSignInClaude:
    'ターミナルで claude を一度実行してサインインしてください。',
  hintSignInCodex: 'ターミナルで codex login を実行してください。',
  warnApiKeyIgnored:
    'このパソコンに ANTHROPIC_API_KEY が設定されていますが無視され、Claude のサブスクリプションで実行されます。',
  warnStatusFailed:
    'サインイン状態を取得できませんでした。ターミナルでCLIを一度実行してから、もう一度確認してください。',
  warnOther: 'ヘルパーからの警告: {code}',
  errNotInstalled:
    'ヘルパーがまだインストールされていないか、インストール後にブラウザを再起動していません。',
  errForbidden:
    'ヘルパーがまだこの拡張機能を許可していません。上のIDでインストーラーをもう一度実行してください。',
  errOutdated:
    'ヘルパーが古くなっています。インストーラーをもう一度実行してください。',
  errUnresponsive:
    'ヘルパーが応答しません。もう一度確認するか、ブラウザを再起動してください。',
  errOther: 'ヘルパーに接続できませんでした。もう一度確認してください。',
  readySummary:
    '準備完了です。{cli} はインストール済みでサインインしています。',
  modelCleared:
    '「{model}」は {cli} では使えないため、既定のモデルを使用します。',
} satisfies LocaleMessages['bridgeUi'];
