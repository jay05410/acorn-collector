import { defineMessages } from '../define';

/**
 * Analysis failures, chosen by AIError.code or, for the local CLI bridge, by
 * the stable bridge message code (see src/lib/ai/error-messages.ts).
 */
export default defineMessages({
  en: {
    notConfiguredTitle: 'No AI provider connected',
    notConfiguredBody:
      'Choose a provider and add your API key in Settings to extract items from images.',
    authTitle: 'API key not accepted',
    authBody:
      'The provider rejected your API key. Check or replace it in Settings.',
    rateLimitTitle: 'Too many requests',
    rateLimitBody:
      'The provider is limiting requests right now. Wait a moment and try again.',
    quotaTitle: 'Usage limit reached',
    quotaBody:
      'Your provider account is out of credit or over its limit. Check your plan, or switch providers in Settings.',
    networkTitle: 'Connection problem',
    networkBody:
      "Couldn't reach the AI provider or load the images. Check your connection and try again.",
    timeoutTitle: 'Took too long',
    timeoutBody:
      "The model didn't finish in time. Try again, or use accurate mode for busy price lists.",
    cancelledTitle: 'Analysis stopped',
    cancelledBody: 'Nothing was lost. You can start it again at any time.',
    badResponseTitle: "Couldn't read the result",
    badResponseBody:
      "The model's answer wasn't a usable price list. Accurate mode often does better.",
    refusedTitle: 'The model declined',
    refusedBody:
      'The model would not analyze this content. Try accurate mode or other images.',
    unavailableTitle: 'Service unavailable',
    unavailableBody:
      'The AI service is temporarily unavailable. Try again in a moment.',
    unknownTitle: 'Analysis failed',
    unknownBody: 'Something went wrong while analyzing. Please try again.',
    bridgeNotInstalledTitle: 'Local bridge not installed',
    bridgeNotInstalledBody:
      'Install the bridge on this computer to analyze with Claude Code or Codex. Setup steps are in Settings.',
    bridgeForbiddenTitle: 'Bridge blocks this extension',
    bridgeForbiddenBody:
      'The installed bridge does not allow this extension. Run the installer again from Settings.',
    bridgeDisconnectedTitle: 'Bridge disconnected',
    bridgeDisconnectedBody:
      'The local bridge stopped unexpectedly. Try again.',
    bridgePermissionMissingTitle: 'Permission needed',
    bridgePermissionMissingBody:
      'Allow the extension to talk to the local bridge in Settings, then try again.',
    bridgeUnresponsiveTitle: 'Bridge not responding',
    bridgeUnresponsiveBody:
      'The local bridge stopped answering. Try again.',
    bridgeOutdatedTitle: 'Bridge needs an update',
    bridgeOutdatedBody:
      'The installed bridge does not match this version of the extension. Reinstall it from Settings.',
    bridgeProtocolErrorTitle: 'Unexpected bridge reply',
    bridgeProtocolErrorBody:
      'The local bridge sent something unexpected. If this keeps happening, reinstall it from Settings.',
    bridgeBusyTitle: 'Bridge is busy',
    bridgeBusyBody:
      'The local CLI is still working on another request. Try again shortly.',
    bridgeBadRequestTitle: 'Request too large',
    bridgeBadRequestBody:
      "This request couldn't be sent to the local CLI, usually because the images are too large. Include fewer images and try again.",
    bridgeInternalTitle: 'Bridge error',
    bridgeInternalBody: 'The local bridge hit an internal error. Try again.',
    cliNotInstalledTitle: 'CLI not found',
    cliNotInstalledBody:
      'Claude Code or Codex is not installed, or the bridge cannot find it. Check Settings.',
    cliNotLoggedInTitle: 'Sign in to the CLI',
    cliNotLoggedInBody:
      'Sign in to Claude Code or Codex in your terminal, then try again.',
    cliRateLimitedTitle: 'CLI usage limit reached',
    cliRateLimitedBody:
      'Your Claude Code or Codex plan has hit its usage limit. Try again later or switch providers.',
    cliTimeoutTitle: 'CLI took too long',
    cliTimeoutBody: "The local CLI didn't finish in time. Try again.",
    cliFailedTitle: 'CLI run failed',
    cliFailedBody:
      'The local CLI exited with an error. Check the selected model in Settings and try again.',
    cliBadOutputTitle: "Couldn't read the CLI result",
    cliBadOutputBody:
      "The CLI's answer didn't match the price-list format. Try again.",
    cliStatusCheckFailedTitle: "Couldn't check the CLI",
    cliStatusCheckFailedBody:
      'The bridge could not check whether the CLI is signed in. Try again.',
    actionOpenSettings: 'Open Settings',
    actionRetry: 'Try again',
    actionRetryAccurate: 'Try accurate mode',
  },
  ko: {
    notConfiguredTitle: 'AI가 연결되지 않았어요',
    notConfiguredBody:
      '설정에서 AI 제공자를 고르고 API 키를 입력하면 이미지에서 상품을 추출할 수 있어요.',
    authTitle: 'API 키가 거부됐어요',
    authBody: '제공자가 API 키를 받아들이지 않았어요. 설정에서 키를 확인하거나 바꿔 주세요.',
    rateLimitTitle: '요청이 너무 많아요',
    rateLimitBody: '제공자가 지금 요청을 제한하고 있어요. 잠시 후 다시 시도해 주세요.',
    quotaTitle: '사용 한도에 도달했어요',
    quotaBody:
      '제공자 계정의 크레딧이 부족하거나 한도를 넘었어요. 요금제를 확인하거나 설정에서 다른 제공자로 바꿔 주세요.',
    networkTitle: '연결에 문제가 있어요',
    networkBody:
      'AI 제공자에 연결하지 못했거나 이미지를 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
    timeoutTitle: '시간이 너무 오래 걸렸어요',
    timeoutBody:
      '모델이 제한 시간 안에 끝내지 못했어요. 다시 시도하거나, 복잡한 가격표라면 정밀 모드를 써 보세요.',
    cancelledTitle: '분석을 멈췄어요',
    cancelledBody: '잃어버린 내용은 없어요. 언제든 다시 시작할 수 있어요.',
    badResponseTitle: '결과를 읽지 못했어요',
    badResponseBody:
      '모델의 답이 쓸 수 있는 가격표 형식이 아니었어요. 정밀 모드가 더 잘 읽을 때가 많아요.',
    refusedTitle: '모델이 분석을 거절했어요',
    refusedBody: '모델이 이 내용을 분석하지 않았어요. 정밀 모드나 다른 이미지로 시도해 보세요.',
    unavailableTitle: '서비스를 쓸 수 없어요',
    unavailableBody: 'AI 서비스가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
    unknownTitle: '분석에 실패했어요',
    unknownBody: '분석 중에 문제가 생겼어요. 다시 시도해 주세요.',
    bridgeNotInstalledTitle: '로컬 브리지가 설치되지 않았어요',
    bridgeNotInstalledBody:
      'Claude Code나 Codex로 분석하려면 이 컴퓨터에 브리지를 설치해 주세요. 설치 방법은 설정에 있어요.',
    bridgeForbiddenTitle: '브리지가 이 확장 프로그램을 막고 있어요',
    bridgeForbiddenBody:
      '설치된 브리지가 이 확장 프로그램을 허용하지 않아요. 설정에서 설치 프로그램을 다시 실행해 주세요.',
    bridgeDisconnectedTitle: '브리지 연결이 끊겼어요',
    bridgeDisconnectedBody: '로컬 브리지가 예기치 않게 멈췄어요. 다시 시도해 주세요.',
    bridgePermissionMissingTitle: '권한이 필요해요',
    bridgePermissionMissingBody:
      '설정에서 로컬 브리지와 통신할 수 있도록 허용한 뒤 다시 시도해 주세요.',
    bridgeUnresponsiveTitle: '브리지가 응답하지 않아요',
    bridgeUnresponsiveBody: '로컬 브리지가 응답을 멈췄어요. 다시 시도해 주세요.',
    bridgeOutdatedTitle: '브리지 업데이트가 필요해요',
    bridgeOutdatedBody:
      '설치된 브리지가 이 확장 프로그램 버전과 맞지 않아요. 설정에서 다시 설치해 주세요.',
    bridgeProtocolErrorTitle: '브리지 응답이 이상해요',
    bridgeProtocolErrorBody:
      '로컬 브리지가 예상하지 못한 응답을 보냈어요. 계속 그러면 설정에서 다시 설치해 주세요.',
    bridgeBusyTitle: '브리지가 바빠요',
    bridgeBusyBody: '로컬 CLI가 아직 다른 요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.',
    bridgeBadRequestTitle: '요청이 너무 커요',
    bridgeBadRequestBody:
      '이미지가 너무 커서 로컬 CLI로 요청을 보내지 못했어요. 이미지를 줄여서 다시 시도해 주세요.',
    bridgeInternalTitle: '브리지 오류',
    bridgeInternalBody: '로컬 브리지에서 내부 오류가 났어요. 다시 시도해 주세요.',
    cliNotInstalledTitle: 'CLI를 찾을 수 없어요',
    cliNotInstalledBody:
      'Claude Code나 Codex가 설치되지 않았거나 브리지가 찾지 못했어요. 설정을 확인해 주세요.',
    cliNotLoggedInTitle: 'CLI에 로그인해 주세요',
    cliNotLoggedInBody: '터미널에서 Claude Code나 Codex에 로그인한 뒤 다시 시도해 주세요.',
    cliRateLimitedTitle: 'CLI 사용 한도에 도달했어요',
    cliRateLimitedBody:
      'Claude Code나 Codex 요금제의 사용 한도를 넘었어요. 나중에 다시 시도하거나 다른 제공자로 바꿔 주세요.',
    cliTimeoutTitle: 'CLI가 너무 오래 걸렸어요',
    cliTimeoutBody: '로컬 CLI가 제한 시간 안에 끝내지 못했어요. 다시 시도해 주세요.',
    cliFailedTitle: 'CLI 실행에 실패했어요',
    cliFailedBody:
      '로컬 CLI가 오류로 종료됐어요. 설정에서 선택한 모델을 확인하고 다시 시도해 주세요.',
    cliBadOutputTitle: 'CLI 결과를 읽지 못했어요',
    cliBadOutputBody: 'CLI의 답이 가격표 형식과 맞지 않았어요. 다시 시도해 주세요.',
    cliStatusCheckFailedTitle: 'CLI 상태를 확인하지 못했어요',
    cliStatusCheckFailedBody:
      '브리지가 CLI 로그인 여부를 확인하지 못했어요. 다시 시도해 주세요.',
    actionOpenSettings: '설정 열기',
    actionRetry: '다시 시도',
    actionRetryAccurate: '정밀 모드로 다시 시도',
  },
  ja: {
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
  },
  'zh-CN': {
    notConfiguredTitle: '尚未连接 AI',
    notConfiguredBody:
      '在设置中选择 AI 服务商并填写 API 密钥后，即可从图片中提取商品。',
    authTitle: 'API 密钥被拒绝',
    authBody: '服务商未接受你的 API 密钥。请在设置中检查或更换。',
    rateLimitTitle: '请求过多',
    rateLimitBody: '服务商目前正在限制请求。请稍候再试。',
    quotaTitle: '已达使用上限',
    quotaBody:
      '服务商账户余额不足或已超出限额。请检查你的套餐，或在设置中切换服务商。',
    networkTitle: '连接出现问题',
    networkBody: '无法连接 AI 服务商或无法加载图片。请检查网络后重试。',
    timeoutTitle: '耗时过长',
    timeoutBody: '模型未能在限定时间内完成。请重试；价格表较复杂时可改用精准模式。',
    cancelledTitle: '已停止分析',
    cancelledBody: '内容没有丢失，可以随时重新开始。',
    badResponseTitle: '无法读取结果',
    badResponseBody: '模型的回答不是可用的价格表格式。精准模式通常识别得更好。',
    refusedTitle: '模型拒绝了分析',
    refusedBody: '模型没有分析这些内容。请尝试精准模式或换一张图片。',
    unavailableTitle: '服务暂不可用',
    unavailableBody: 'AI 服务暂时不可用。请稍后再试。',
    unknownTitle: '分析失败',
    unknownBody: '分析时出现问题。请重试。',
    bridgeNotInstalledTitle: '未安装本地桥接程序',
    bridgeNotInstalledBody:
      '要使用 Claude Code 或 Codex 分析，请在这台电脑上安装桥接程序。安装步骤见设置。',
    bridgeForbiddenTitle: '桥接程序阻止了此扩展',
    bridgeForbiddenBody: '已安装的桥接程序不允许此扩展。请在设置中重新运行安装程序。',
    bridgeDisconnectedTitle: '桥接程序已断开',
    bridgeDisconnectedBody: '本地桥接程序意外停止。请重试。',
    bridgePermissionMissingTitle: '需要权限',
    bridgePermissionMissingBody: '请在设置中允许扩展与本地桥接程序通信，然后重试。',
    bridgeUnresponsiveTitle: '桥接程序无响应',
    bridgeUnresponsiveBody: '本地桥接程序停止了响应。请重试。',
    bridgeOutdatedTitle: '桥接程序需要更新',
    bridgeOutdatedBody: '已安装的桥接程序与此扩展版本不匹配。请在设置中重新安装。',
    bridgeProtocolErrorTitle: '桥接程序响应异常',
    bridgeProtocolErrorBody:
      '本地桥接程序返回了意外的响应。如果反复出现，请在设置中重新安装。',
    bridgeBusyTitle: '桥接程序繁忙',
    bridgeBusyBody: '本地 CLI 仍在处理其他请求。请稍后再试。',
    bridgeBadRequestTitle: '请求过大',
    bridgeBadRequestBody:
      '图片太大，无法把请求发送到本地 CLI。请减少图片后重试。',
    bridgeInternalTitle: '桥接程序出错',
    bridgeInternalBody: '本地桥接程序发生内部错误。请重试。',
    cliNotInstalledTitle: '找不到 CLI',
    cliNotInstalledBody:
      '未安装 Claude Code 或 Codex，或桥接程序找不到它。请检查设置。',
    cliNotLoggedInTitle: '请登录 CLI',
    cliNotLoggedInBody: '请在终端中登录 Claude Code 或 Codex，然后重试。',
    cliRateLimitedTitle: 'CLI 已达使用上限',
    cliRateLimitedBody:
      '你的 Claude Code 或 Codex 套餐已达使用上限。请稍后再试或切换服务商。',
    cliTimeoutTitle: 'CLI 耗时过长',
    cliTimeoutBody: '本地 CLI 未能在限定时间内完成。请重试。',
    cliFailedTitle: 'CLI 运行失败',
    cliFailedBody: '本地 CLI 因错误退出。请在设置中检查所选模型后重试。',
    cliBadOutputTitle: '无法读取 CLI 结果',
    cliBadOutputBody: 'CLI 的回答与价格表格式不符。请重试。',
    cliStatusCheckFailedTitle: '无法检查 CLI 状态',
    cliStatusCheckFailedBody: '桥接程序无法确认 CLI 是否已登录。请重试。',
    actionOpenSettings: '打开设置',
    actionRetry: '重试',
    actionRetryAccurate: '用精准模式重试',
  },
  'zh-TW': {
    notConfiguredTitle: '尚未連接 AI',
    notConfiguredBody:
      '在設定中選擇 AI 服務商並輸入 API 金鑰後，就能從圖片中擷取商品。',
    authTitle: 'API 金鑰遭拒',
    authBody: '服務商不接受你的 API 金鑰。請在設定中檢查或更換。',
    rateLimitTitle: '請求過多',
    rateLimitBody: '服務商目前正在限制請求。請稍候再試。',
    quotaTitle: '已達使用上限',
    quotaBody:
      '服務商帳戶的額度不足或已超過上限。請檢查你的方案，或在設定中切換服務商。',
    networkTitle: '連線發生問題',
    networkBody: '無法連線到 AI 服務商或無法載入圖片。請檢查網路後重試。',
    timeoutTitle: '耗時過久',
    timeoutBody: '模型未能在時限內完成。請重試；價目表較複雜時可改用精準模式。',
    cancelledTitle: '已停止分析',
    cancelledBody: '內容沒有遺失，隨時可以重新開始。',
    badResponseTitle: '無法讀取結果',
    badResponseBody: '模型的回答不是可用的價目表格式。精準模式通常辨識得更好。',
    refusedTitle: '模型拒絕了分析',
    refusedBody: '模型沒有分析這些內容。請試試精準模式或換一張圖片。',
    unavailableTitle: '服務暫時無法使用',
    unavailableBody: 'AI 服務暫時無法使用。請稍後再試。',
    unknownTitle: '分析失敗',
    unknownBody: '分析時發生問題。請重試。',
    bridgeNotInstalledTitle: '尚未安裝本機橋接程式',
    bridgeNotInstalledBody:
      '若要使用 Claude Code 或 Codex 分析，請在這台電腦安裝橋接程式。安裝步驟請見設定。',
    bridgeForbiddenTitle: '橋接程式封鎖了此擴充功能',
    bridgeForbiddenBody: '已安裝的橋接程式不允許此擴充功能。請在設定中重新執行安裝程式。',
    bridgeDisconnectedTitle: '橋接程式已中斷連線',
    bridgeDisconnectedBody: '本機橋接程式意外停止。請重試。',
    bridgePermissionMissingTitle: '需要權限',
    bridgePermissionMissingBody: '請在設定中允許擴充功能與本機橋接程式通訊，然後重試。',
    bridgeUnresponsiveTitle: '橋接程式沒有回應',
    bridgeUnresponsiveBody: '本機橋接程式停止回應。請重試。',
    bridgeOutdatedTitle: '橋接程式需要更新',
    bridgeOutdatedBody: '已安裝的橋接程式與此擴充功能版本不符。請在設定中重新安裝。',
    bridgeProtocolErrorTitle: '橋接程式回應異常',
    bridgeProtocolErrorBody:
      '本機橋接程式傳回了非預期的回應。若持續發生，請在設定中重新安裝。',
    bridgeBusyTitle: '橋接程式忙碌中',
    bridgeBusyBody: '本機 CLI 仍在處理其他請求。請稍後再試。',
    bridgeBadRequestTitle: '請求過大',
    bridgeBadRequestBody:
      '圖片太大，無法將請求傳送到本機 CLI。請減少圖片後重試。',
    bridgeInternalTitle: '橋接程式錯誤',
    bridgeInternalBody: '本機橋接程式發生內部錯誤。請重試。',
    cliNotInstalledTitle: '找不到 CLI',
    cliNotInstalledBody:
      '尚未安裝 Claude Code 或 Codex，或橋接程式找不到它。請檢查設定。',
    cliNotLoggedInTitle: '請登入 CLI',
    cliNotLoggedInBody: '請在終端機登入 Claude Code 或 Codex，然後重試。',
    cliRateLimitedTitle: 'CLI 已達使用上限',
    cliRateLimitedBody:
      '你的 Claude Code 或 Codex 方案已達使用上限。請稍後再試或切換服務商。',
    cliTimeoutTitle: 'CLI 耗時過久',
    cliTimeoutBody: '本機 CLI 未能在時限內完成。請重試。',
    cliFailedTitle: 'CLI 執行失敗',
    cliFailedBody: '本機 CLI 因錯誤而結束。請在設定中檢查所選模型後重試。',
    cliBadOutputTitle: '無法讀取 CLI 結果',
    cliBadOutputBody: 'CLI 的回答與價目表格式不符。請重試。',
    cliStatusCheckFailedTitle: '無法檢查 CLI 狀態',
    cliStatusCheckFailedBody: '橋接程式無法確認 CLI 是否已登入。請重試。',
    actionOpenSettings: '開啟設定',
    actionRetry: '重試',
    actionRetryAccurate: '以精準模式重試',
  },
});
