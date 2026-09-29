import type { LocaleMessages } from '../../define';

/**
 * Analysis failures, chosen by AIError.code or, for the local CLI bridge, by
 * the stable bridge message code (see src/lib/ai/error-messages.ts).
 */
export default {
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
  timeoutBody:
    '模型未能在限定时间内完成。请重试；价格表较复杂时可改用精准模式。',
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
  bridgeForbiddenBody:
    '已安装的桥接程序不允许此扩展。请在设置中重新运行安装程序。',
  bridgeDisconnectedTitle: '桥接程序已断开',
  bridgeDisconnectedBody: '本地桥接程序意外停止。请重试。',
  bridgePermissionMissingTitle: '需要权限',
  bridgePermissionMissingBody:
    '请在设置中允许扩展与本地桥接程序通信，然后重试。',
  bridgeUnresponsiveTitle: '桥接程序无响应',
  bridgeUnresponsiveBody: '本地桥接程序停止了响应。请重试。',
  bridgeOutdatedTitle: '桥接程序需要更新',
  bridgeOutdatedBody:
    '已安装的桥接程序与此扩展版本不匹配。请在设置中重新安装。',
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
} satisfies LocaleMessages['aiErrors'];
