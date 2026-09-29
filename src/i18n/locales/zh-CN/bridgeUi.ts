import type { LocaleMessages } from '../../define';

/**
 * Local CLI bridge setup (ACORN-7). CLI names (Claude Code, Codex) and shell
 * commands are not translated; they arrive as {cli} or are shown verbatim.
 */
export default {
  intro:
    '使用这台电脑上已登录的 Claude Code 或 Codex CLI 进行分析，因此无需 API 密钥。',
  pointSlower: '比 API 密钥方式慢，每张图片约需 10 秒。',
  pointData:
    '图片和帖子文字会以你自己的账号和订阅方案发送给 Anthropic（Claude Code）或 OpenAI（Codex）。',
  pointAdvanced: '面向高级用户：需要 Node.js 20 或更高版本，并进行一次安装。',
  policyNote: '请确认你的订阅方案条款允许这种用法。如不确定，请改用 API 密钥。',
  targetLabel: '使用的 CLI',
  permissionTitle: '允许原生消息通信',
  permissionBody:
    '允许扩展程序与这台电脑上的小型辅助程序通信。Chrome 会请你确认。',
  permissionAllow: '允许',
  permissionGranted: '已允许',
  permissionDenied: '未获得权限。请再次选择“允许”。',
  installTitle: '安装辅助程序',
  installBody: '下载源代码，在终端中打开其中的 native-host 文件夹并运行：',
  installAfter: '然后重启浏览器。',
  extensionId: '扩展程序 ID',
  copy: '复制命令',
  copied: '已复制',
  copyFailed: '无法复制。请选中命令后手动复制。',
  guide: '安装说明',
  statusTitle: '检查连接',
  check: '检查',
  checkAgain: '重新检查',
  checking: '正在检查辅助程序...',
  inUse: '使用中',
  installed: '已安装',
  notInstalled: '未安装',
  signedIn: '已登录',
  signedInDetails: '已登录（{details}）',
  notSignedIn: '未登录',
  hintInstallClaude: '请安装 Claude Code，然后重新运行安装程序。',
  hintInstallCodex: '请安装 Codex，然后重新运行安装程序。',
  hintSignInClaude: '在终端中运行一次 claude 并登录。',
  hintSignInCodex: '在终端中运行 codex login。',
  warnApiKeyIgnored:
    '这台电脑设置了 ANTHROPIC_API_KEY，但会被忽略，将使用你的 Claude 订阅。',
  warnStatusFailed: '无法读取登录状态。请在终端中运行一次 CLI，然后重新检查。',
  warnOther: '辅助程序警告：{code}',
  errNotInstalled: '辅助程序尚未安装，或安装后尚未重启浏览器。',
  errForbidden:
    '辅助程序尚未允许此扩展程序。请使用上方的 ID 重新运行安装程序。',
  errOutdated: '辅助程序版本过旧。请重新运行安装程序。',
  errUnresponsive: '辅助程序没有响应。请重新检查或重启浏览器。',
  errOther: '无法连接到辅助程序，请重新检查。',
  readySummary: '已就绪：{cli} 已安装并已登录。',
  modelCleared: '"{model}" 无法用于 {cli}，将改用默认模型。',
} satisfies LocaleMessages['bridgeUi'];
