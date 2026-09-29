import type { LocaleMessages } from '../../define';

/**
 * AI connection settings (ACORN-7): provider cards, API keys and the
 * OpenRouter sign-in. Provider brand names are not translated and are passed
 * in as {provider}.
 */
export default {
  providerGroup: 'AI 서비스',
  providerCli: '로컬 CLI',
  recommended: '추천',
  advanced: '고급',
  statusReady: '사용 가능',
  statusNotConnected: '연결 안 됨',
  statusSetup: '설정 필요',
  statusCheckKey: '키 확인 필요',
  descOpenrouter:
    '클릭 한 번으로 로그인합니다. 여러 모델을 쓴 만큼만 크레딧으로 결제합니다.',
  descOpenai: '내 OpenAI API 키를 사용합니다.',
  descAnthropic: 'Claude를 쓰기 위해 내 Anthropic API 키를 사용합니다.',
  descCli:
    '이 컴퓨터에 로그인되어 있는 Claude Code 또는 Codex CLI를 사용합니다.',
  speedOpenrouter: '속도는 모델에 따라 다름',
  speedOpenai: '측정 결과 이미지당 약 2-4초',
  speedCli: '느림: 이미지당 약 10초',
  defaultModel: '기본 모델: {model}',
  costOpenrouter: 'OpenRouter 크레딧 사용',
  costOpenai: '내 OpenAI 계정으로 청구',
  costAnthropic: '내 Anthropic 계정으로 청구',
  costCli: 'API 키 없이 CLI 요금제로 실행',
  summaryNone:
    '연결된 AI 서비스가 없습니다. 부스와 상품은 직접 입력해 추가할 수 있습니다.',
  summaryReady: '준비됐습니다. 분석은 {provider}에서 실행됩니다.',
  summaryNotReady:
    '{provider} 설정이 끝나지 않았습니다. 아래 단계를 마치면 이미지를 분석할 수 있습니다.',
  summaryKeyRejected:
    '{provider}에서 저장된 키를 받아들이지 않았습니다. 아래에서 키를 확인하거나 바꿔 주세요.',
  keyLabel: '{provider} API 키',
  keyHint: '이 브라우저에만 저장되며 {provider}에만 전송됩니다.',
  keySaved: '저장된 키 (끝자리 {last4})',
  changeKey: '변경',
  removeKey: '삭제',
  saveKey: '키 저장',
  showKey: '키 보기',
  hideKey: '키 숨기기',
  keyRequired: '먼저 키를 입력하세요.',
  keySavedToast: '키를 저장했습니다.',
  keyRemovedToast: '키를 삭제했습니다.',
  getKey: 'API 키 발급받기',
  testConnection: '연결 테스트',
  testOk: '연결됐습니다. {provider}에서 키를 확인했습니다.',
  testFailed: '연결 실패',
  errAuth:
    '키가 거부됐습니다. 키 전체를 복사했는지, 아직 유효한 키인지 확인하세요.',
  errQuota: '계정의 크레딧이 부족하거나 사용 한도에 도달했습니다.',
  errRateLimit: '지금은 요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
  errNetwork: '{provider}에 연결할 수 없습니다. 인터넷 연결을 확인하세요.',
  errTimeout: '{provider}의 응답이 너무 늦습니다. 다시 시도하세요.',
  errUnavailable:
    '{provider} 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도하세요.',
  errUnknown: '문제가 발생했습니다. 다시 시도하세요.',
  orIntro:
    'OpenRouter에 로그인해 이 확장 프로그램용 키를 승인하세요. 키는 내 OpenRouter 계정에 속하며 이 브라우저에만 저장됩니다.',
  orConnect: 'OpenRouter로 연결',
  orUseCode: '코드로 연결하기',
  orPasteKey: '기존 키 붙여넣기',
  orRedirectFailed:
    '로그인이 완료되지 않았습니다. 다시 시도하거나 코드로 연결하세요.',
  orCodeTitle: '코드로 연결',
  orCodeStep1: '방금 열린 OpenRouter 탭에서 접근을 승인하세요.',
  orCodeReopen: 'OpenRouter 다시 열기',
  orCodeStep2:
    'OpenRouter에 표시된 코드(또는 그 페이지 주소)를 복사해 여기에 붙여넣으세요.',
  orCodeLabel: 'OpenRouter 코드',
  orCodeSubmit: '연결',
  orCodeInvalid:
    'OpenRouter 코드가 아닌 것 같습니다. 코드나 페이지 주소 전체를 붙여넣으세요.',
  orCodeRejected:
    'OpenRouter가 코드를 받아들이지 않았습니다. 코드는 한 번만 쓸 수 있고 10분 뒤 만료되니 처음부터 다시 받아 주세요.',
  orStartOver: '처음부터 다시',
  orManualTitle: '기존 키 붙여넣기',
  orConnectedOauth: 'OpenRouter 로그인으로 연결됨',
  orConnectedManual: '붙여넣은 키로 연결됨',
  orKeyName: '키 이름',
  orLimit: '크레딧 한도',
  orNoLimit: '한도 없음',
  orRemaining: '남은 크레딧',
  orUsage: '지금까지 사용',
  orResets: '한도 초기화',
  resetDaily: '매일',
  resetWeekly: '매주',
  resetMonthly: '매월',
  orFreeTier: '무료 등급',
  orKeyInfoFailed: '키의 크레딧 정보를 불러오지 못했습니다.',
  orKeyInvalid:
    '이 키는 더 이상 쓸 수 없습니다. 연결을 해제한 뒤 다시 연결하세요.',
  orSaveFailed:
    'OpenRouter에서 키를 만들었지만 이 브라우저에 저장하지 못했습니다. 이 페이지를 떠나기 전에 다시 저장하세요. 떠나면 다시 연결해야 합니다.',
  orRetrySave: '다시 저장',
  orCodeStartFailed:
    '코드 연결을 시작하지 못했습니다. 다시 시도하거나 키를 붙여넣으세요.',
  orManage: 'OpenRouter에서 키 관리',
  refresh: '새로고침',
  disconnect: '연결 해제',
  connectedToast: '{provider}에 연결했습니다.',
  disconnectedToast:
    '{provider} 연결을 해제했습니다. 키는 {provider} 계정에 그대로 남아 있습니다.',
} satisfies LocaleMessages['aiConnect'];
