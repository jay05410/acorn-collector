import type { LocaleMessages } from '../../define';

/**
 * Analysis failures, chosen by AIError.code or, for the local CLI bridge, by
 * the stable bridge message code (see src/lib/ai/error-messages.ts).
 */
export default {
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
  bridgeForbiddenBody:
    '已安裝的橋接程式不允許此擴充功能。請在設定中重新執行安裝程式。',
  bridgeDisconnectedTitle: '橋接程式已中斷連線',
  bridgeDisconnectedBody: '本機橋接程式意外停止。請重試。',
  bridgePermissionMissingTitle: '需要權限',
  bridgePermissionMissingBody:
    '請在設定中允許擴充功能與本機橋接程式通訊，然後重試。',
  bridgeUnresponsiveTitle: '橋接程式沒有回應',
  bridgeUnresponsiveBody: '本機橋接程式停止回應。請重試。',
  bridgeOutdatedTitle: '橋接程式需要更新',
  bridgeOutdatedBody:
    '已安裝的橋接程式與此擴充功能版本不符。請在設定中重新安裝。',
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
} satisfies LocaleMessages['aiErrors'];
