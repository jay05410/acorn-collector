import type { LocaleMessages } from '../../define';

/**
 * Local CLI bridge setup (ACORN-7). CLI names (Claude Code, Codex) and shell
 * commands are not translated; they arrive as {cli} or are shown verbatim.
 */
export default {
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
  modelCleared: '"{model}" 모델은 {cli}에서 쓸 수 없어 기본 모델을 사용합니다.',
} satisfies LocaleMessages['bridgeUi'];
