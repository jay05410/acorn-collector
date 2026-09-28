import { defineMessages } from '../define';

/**
 * Local CLI bridge setup (ACORN-7). CLI names (Claude Code, Codex) and shell
 * commands are not translated; they arrive as {cli} or are shown verbatim.
 */
export default defineMessages({
  en: {
    intro:
      'Runs analysis on the Claude Code or Codex CLI you are already signed in to on this computer, so no API key is needed.',
    pointSlower: 'Slower than an API key: about 10 seconds per image.',
    pointData:
      'Images and post text go to Anthropic (Claude Code) or OpenAI (Codex) under your own account and plan.',
    pointAdvanced:
      'For advanced users: needs Node.js 20 or later and a one-time install.',
    policyNote:
      "Check that your plan's terms allow this use. If you are unsure, use an API key instead.",
    targetLabel: 'CLI to use',
    permissionTitle: 'Allow native messaging',
    permissionBody:
      'Lets the extension talk to a small helper program on this computer. Chrome asks you to confirm.',
    permissionAllow: 'Allow',
    permissionGranted: 'Allowed',
    permissionDenied: "Permission wasn't granted. Select Allow to try again.",
    installTitle: 'Install the helper',
    installBody:
      'Download the source code, open its native-host folder in a terminal and run:',
    installAfter: 'Then restart the browser.',
    extensionId: 'Extension ID',
    copy: 'Copy command',
    copied: 'Copied',
    copyFailed: "Couldn't copy. Select the command and copy it yourself.",
    guide: 'Installation guide',
    statusTitle: 'Check the connection',
    check: 'Check',
    checkAgain: 'Check again',
    checking: 'Checking the helper...',
    inUse: 'In use',
    installed: 'Installed',
    notInstalled: 'Not installed',
    signedIn: 'Signed in',
    signedInDetails: 'Signed in ({details})',
    notSignedIn: 'Not signed in',
    hintInstallClaude: 'Install Claude Code, then run the installer again.',
    hintInstallCodex: 'Install Codex, then run the installer again.',
    hintSignInClaude: 'Run claude in a terminal once and sign in.',
    hintSignInCodex: 'Run codex login in a terminal.',
    warnApiKeyIgnored:
      'ANTHROPIC_API_KEY is set on this computer but ignored, so your Claude subscription is used.',
    warnStatusFailed:
      "Couldn't read the sign-in status. Run the CLI once in a terminal, then check again.",
    warnOther: 'Warning from the helper: {code}',
    errNotInstalled:
      "The helper isn't installed yet, or the browser hasn't been restarted since it was installed.",
    errForbidden:
      "The helper doesn't allow this extension yet. Run the installer again with the ID above.",
    errOutdated: 'The helper is out of date. Run the installer again.',
    errUnresponsive:
      "The helper didn't answer. Check again, or restart the browser.",
    errOther: "Couldn't reach the helper. Please check again.",
    readySummary: 'Ready: {cli} is installed and signed in.',
    modelCleared:
      '"{model}" does not work with {cli}, so the default model will be used.',
  },
  ko: {
    intro:
      '이 컴퓨터에 이미 로그인된 Claude Code 또는 Codex CLI로 분석을 실행하므로 API 키가 필요 없습니다.',
    pointSlower: 'API 키 방식보다 느립니다. 이미지당 약 10초가 걸립니다.',
    pointData:
      '이미지와 게시글은 내 계정과 요금제로 Anthropic(Claude Code) 또는 OpenAI(Codex)에 전송됩니다.',
    pointAdvanced:
      '고급 사용자용 기능입니다. Node.js 20 이상과 한 번의 설치가 필요합니다.',
    policyNote:
      '내 요금제 약관이 이런 사용을 허용하는지 확인하세요. 확실하지 않다면 API 키 방식을 쓰세요.',
    targetLabel: '사용할 CLI',
    permissionTitle: '네이티브 메시징 허용',
    permissionBody:
      '확장 프로그램이 이 컴퓨터의 작은 도우미 프로그램과 통신하도록 허용합니다. Chrome이 확인을 요청합니다.',
    permissionAllow: '허용',
    permissionGranted: '허용됨',
    permissionDenied: '권한이 허용되지 않았습니다. 다시 하려면 허용을 누르세요.',
    installTitle: '도우미 설치',
    installBody:
      '소스 코드를 내려받아 native-host 폴더를 터미널에서 열고 다음을 실행하세요.',
    installAfter: '그런 다음 브라우저를 다시 시작하세요.',
    extensionId: '확장 프로그램 ID',
    copy: '명령어 복사',
    copied: '복사됨',
    copyFailed: '복사하지 못했습니다. 명령어를 선택해 직접 복사하세요.',
    guide: '설치 안내',
    statusTitle: '연결 확인',
    check: '확인',
    checkAgain: '다시 확인',
    checking: '도우미를 확인하는 중...',
    inUse: '사용 중',
    installed: '설치됨',
    notInstalled: '설치 안 됨',
    signedIn: '로그인됨',
    signedInDetails: '로그인됨 ({details})',
    notSignedIn: '로그인 안 됨',
    hintInstallClaude: 'Claude Code를 설치한 뒤 설치 명령을 다시 실행하세요.',
    hintInstallCodex: 'Codex를 설치한 뒤 설치 명령을 다시 실행하세요.',
    hintSignInClaude: '터미널에서 claude를 한 번 실행해 로그인하세요.',
    hintSignInCodex: '터미널에서 codex login을 실행하세요.',
    warnApiKeyIgnored:
      '이 컴퓨터에 ANTHROPIC_API_KEY가 설정되어 있지만 무시되며, Claude 구독으로 실행됩니다.',
    warnStatusFailed:
      '로그인 상태를 읽지 못했습니다. 터미널에서 CLI를 한 번 실행한 뒤 다시 확인하세요.',
    warnOther: '도우미 경고: {code}',
    errNotInstalled:
      '도우미가 아직 설치되지 않았거나, 설치 후 브라우저를 다시 시작하지 않았습니다.',
    errForbidden:
      '도우미가 아직 이 확장 프로그램을 허용하지 않습니다. 위의 ID로 설치 명령을 다시 실행하세요.',
    errOutdated: '도우미 버전이 오래되었습니다. 설치 명령을 다시 실행하세요.',
    errUnresponsive:
      '도우미가 응답하지 않습니다. 다시 확인하거나 브라우저를 다시 시작하세요.',
    errOther: '도우미에 연결하지 못했습니다. 다시 확인해주세요.',
    readySummary: '준비됐습니다. {cli} 설치와 로그인이 확인됐습니다.',
    modelCleared:
      '"{model}" 모델은 {cli}에서 쓸 수 없어 기본 모델을 사용합니다.',
  },
  ja: {
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
    copyFailed: 'コピーできませんでした。コマンドを選択して手動でコピーしてください。',
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
    hintSignInClaude: 'ターミナルで claude を一度実行してサインインしてください。',
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
    errOutdated: 'ヘルパーが古くなっています。インストーラーをもう一度実行してください。',
    errUnresponsive:
      'ヘルパーが応答しません。もう一度確認するか、ブラウザを再起動してください。',
    errOther: 'ヘルパーに接続できませんでした。もう一度確認してください。',
    readySummary: '準備完了です。{cli} はインストール済みでサインインしています。',
    modelCleared:
      '「{model}」は {cli} では使えないため、既定のモデルを使用します。',
  },
  'zh-CN': {
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
    errForbidden: '辅助程序尚未允许此扩展程序。请使用上方的 ID 重新运行安装程序。',
    errOutdated: '辅助程序版本过旧。请重新运行安装程序。',
    errUnresponsive: '辅助程序没有响应。请重新检查或重启浏览器。',
    errOther: '无法连接到辅助程序，请重新检查。',
    readySummary: '已就绪：{cli} 已安装并已登录。',
    modelCleared: '"{model}" 无法用于 {cli}，将改用默认模型。',
  },
  'zh-TW': {
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
    warnStatusFailed: '無法讀取登入狀態。請在終端機中執行一次 CLI，然後重新檢查。',
    warnOther: '輔助程式警告：{code}',
    errNotInstalled: '輔助程式尚未安裝，或安裝後尚未重新啟動瀏覽器。',
    errForbidden: '輔助程式尚未允許這個擴充功能。請使用上方的 ID 重新執行安裝程式。',
    errOutdated: '輔助程式版本過舊。請重新執行安裝程式。',
    errUnresponsive: '輔助程式沒有回應。請重新檢查或重新啟動瀏覽器。',
    errOther: '無法連線到輔助程式，請重新檢查。',
    readySummary: '已就緒：{cli} 已安裝並已登入。',
    modelCleared: '「{model}」無法用於 {cli}，將改用預設模型。',
  },
});
