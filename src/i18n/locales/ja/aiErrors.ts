import type { LocaleMessages } from '../../define';

/**
 * Analysis failures, chosen by AIError.code or, for the local CLI bridge, by
 * the stable bridge message code (see src/lib/ai/error-messages.ts).
 */
export default {
  notConfiguredTitle: 'AIが接続されていません',
  notConfiguredBody:
    '設定でAIプロバイダーを選んでAPIキーを入力すると、画像から商品を抽出できます。',
  authTitle: 'APIキーが拒否されました',
  authBody:
    'プロバイダーがAPIキーを受け付けませんでした。設定でキーを確認するか、差し替えてください。',
  rateLimitTitle: 'リクエストが多すぎます',
  rateLimitBody:
    'プロバイダーが現在リクエストを制限しています。少し待ってから再試行してください。',
  quotaTitle: '利用上限に達しました',
  quotaBody:
    'プロバイダーのアカウントのクレジットが不足しているか、上限を超えています。プランを確認するか、設定で別のプロバイダーに切り替えてください。',
  networkTitle: '接続に問題があります',
  networkBody:
    'AIプロバイダーに接続できないか、画像を読み込めませんでした。接続を確認して再試行してください。',
  timeoutTitle: '時間がかかりすぎました',
  timeoutBody:
    'モデルが制限時間内に完了しませんでした。再試行するか、複雑な価格表なら精度優先モードを使ってください。',
  cancelledTitle: '分析を停止しました',
  cancelledBody: '失われた内容はありません。いつでも再開できます。',
  badResponseTitle: '結果を読み取れませんでした',
  badResponseBody:
    'モデルの回答が使える価格表の形式ではありませんでした。精度優先モードの方がうまく読めることが多いです。',
  refusedTitle: 'モデルが分析を断りました',
  refusedBody:
    'モデルがこの内容を分析しませんでした。精度優先モードか別の画像で試してください。',
  unavailableTitle: 'サービスを利用できません',
  unavailableBody:
    'AIサービスが一時的に利用できません。しばらくしてから再試行してください。',
  unknownTitle: '分析に失敗しました',
  unknownBody: '分析中に問題が発生しました。もう一度お試しください。',
  bridgeNotInstalledTitle: 'ローカルブリッジが未インストールです',
  bridgeNotInstalledBody:
    'Claude CodeやCodexで分析するには、このパソコンにブリッジをインストールしてください。手順は設定にあります。',
  bridgeForbiddenTitle: 'ブリッジがこの拡張機能を拒否しています',
  bridgeForbiddenBody:
    'インストール済みのブリッジがこの拡張機能を許可していません。設定からインストーラーを再実行してください。',
  bridgeDisconnectedTitle: 'ブリッジが切断されました',
  bridgeDisconnectedBody:
    'ローカルブリッジが予期せず停止しました。再試行してください。',
  bridgePermissionMissingTitle: '権限が必要です',
  bridgePermissionMissingBody:
    '設定でローカルブリッジとの通信を許可してから、再試行してください。',
  bridgeUnresponsiveTitle: 'ブリッジが応答しません',
  bridgeUnresponsiveBody:
    'ローカルブリッジが応答しなくなりました。再試行してください。',
  bridgeOutdatedTitle: 'ブリッジの更新が必要です',
  bridgeOutdatedBody:
    'インストール済みのブリッジがこの拡張機能のバージョンと合いません。設定から再インストールしてください。',
  bridgeProtocolErrorTitle: 'ブリッジから想定外の応答',
  bridgeProtocolErrorBody:
    'ローカルブリッジが想定外の応答を返しました。繰り返す場合は設定から再インストールしてください。',
  bridgeBusyTitle: 'ブリッジが処理中です',
  bridgeBusyBody:
    'ローカルCLIが別のリクエストを処理中です。少し待ってから再試行してください。',
  bridgeBadRequestTitle: 'リクエストが大きすぎます',
  bridgeBadRequestBody:
    '画像が大きすぎるため、ローカルCLIにリクエストを送れませんでした。画像を減らして再試行してください。',
  bridgeInternalTitle: 'ブリッジのエラー',
  bridgeInternalBody:
    'ローカルブリッジで内部エラーが発生しました。再試行してください。',
  cliNotInstalledTitle: 'CLIが見つかりません',
  cliNotInstalledBody:
    'Claude CodeまたはCodexがインストールされていないか、ブリッジが見つけられません。設定を確認してください。',
  cliNotLoggedInTitle: 'CLIにログインしてください',
  cliNotLoggedInBody:
    'ターミナルでClaude CodeまたはCodexにログインしてから、再試行してください。',
  cliRateLimitedTitle: 'CLIの利用上限に達しました',
  cliRateLimitedBody:
    'Claude CodeまたはCodexのプランの利用上限に達しました。後で再試行するか、別のプロバイダーに切り替えてください。',
  cliTimeoutTitle: 'CLIに時間がかかりすぎました',
  cliTimeoutBody:
    'ローカルCLIが制限時間内に完了しませんでした。再試行してください。',
  cliFailedTitle: 'CLIの実行に失敗しました',
  cliFailedBody:
    'ローカルCLIがエラーで終了しました。設定で選択中のモデルを確認して再試行してください。',
  cliBadOutputTitle: 'CLIの結果を読み取れませんでした',
  cliBadOutputBody:
    'CLIの回答が価格表の形式と一致しませんでした。再試行してください。',
  cliStatusCheckFailedTitle: 'CLIの状態を確認できませんでした',
  cliStatusCheckFailedBody:
    'ブリッジがCLIのログイン状態を確認できませんでした。再試行してください。',
  actionOpenSettings: '設定を開く',
  actionRetry: '再試行',
  actionRetryAccurate: '精度優先モードで再試行',
} satisfies LocaleMessages['aiErrors'];
