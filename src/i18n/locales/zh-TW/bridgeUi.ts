import type { LocaleMessages } from '../../define';

/**
 * Local CLI bridge setup (ACORN-7). CLI names (Claude Code, Codex) and shell
 * commands are not translated; they arrive as {cli} or are shown verbatim.
 */
export default {
  intro:
    '使用這台電腦上已登入的 Claude Code 或 Codex CLI 進行分析，因此不需要 API 金鑰。',
  pointSlower: '比 API 金鑰方式慢，每張圖片約需 10 秒。',
  pointData:
    '圖片和貼文文字會以你自己的帳號和訂閱方案傳送給 Anthropic（Claude Code）或 OpenAI（Codex）。',
  pointAdvanced: '適合進階使用者：需要 Node.js 20 以上版本，並進行一次安裝。',
  policyNote: '請確認你的訂閱方案條款允許這種用法。若不確定，請改用 API 金鑰。',
  targetLabel: '使用的 CLI',
  permissionTitle: '允許原生訊息傳遞',
  permissionBody:
    '允許擴充功能與這台電腦上的小型輔助程式通訊。Chrome 會請你確認。',
  permissionAllow: '允許',
  permissionGranted: '已允許',
  permissionDenied: '未取得權限。請再次選擇「允許」。',
  installTitle: '安裝輔助程式',
  installBody: '下載原始碼，在終端機中開啟其中的 native-host 資料夾並執行：',
  installAfter: '接著重新啟動瀏覽器。',
  extensionId: '擴充功能 ID',
  copy: '複製指令',
  copied: '已複製',
  copyFailed: '無法複製。請選取指令後手動複製。',
  guide: '安裝說明',
  statusTitle: '檢查連線',
  check: '檢查',
  checkAgain: '重新檢查',
  checking: '正在檢查輔助程式...',
  inUse: '使用中',
  installed: '已安裝',
  notInstalled: '未安裝',
  signedIn: '已登入',
  signedInDetails: '已登入（{details}）',
  notSignedIn: '未登入',
  hintInstallClaude: '請安裝 Claude Code，然後重新執行安裝程式。',
  hintInstallCodex: '請安裝 Codex，然後重新執行安裝程式。',
  hintSignInClaude: '在終端機中執行一次 claude 並登入。',
  hintSignInCodex: '在終端機中執行 codex login。',
  warnApiKeyIgnored:
    '這台電腦設定了 ANTHROPIC_API_KEY，但會被忽略，將使用你的 Claude 訂閱。',
  warnStatusFailed:
    '無法讀取登入狀態。請在終端機中執行一次 CLI，然後重新檢查。',
  warnOther: '輔助程式警告：{code}',
  errNotInstalled: '輔助程式尚未安裝，或安裝後尚未重新啟動瀏覽器。',
  errForbidden:
    '輔助程式尚未允許這個擴充功能。請使用上方的 ID 重新執行安裝程式。',
  errOutdated: '輔助程式版本過舊。請重新執行安裝程式。',
  errUnresponsive: '輔助程式沒有回應。請重新檢查或重新啟動瀏覽器。',
  errOther: '無法連線到輔助程式，請重新檢查。',
  readySummary: '已就緒：{cli} 已安裝並已登入。',
  modelCleared: '「{model}」無法用於 {cli}，將改用預設模型。',
} satisfies LocaleMessages['bridgeUi'];
