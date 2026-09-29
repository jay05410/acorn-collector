import type { LocaleMessages } from '../../define';

/**
 * Analysis failures, chosen by AIError.code or, for the local CLI bridge, by
 * the stable bridge message code (see src/lib/ai/error-messages.ts).
 */
export default {
  notConfiguredTitle: 'AI가 연결되지 않았어요',
  notConfiguredBody:
    '설정에서 AI 제공자를 고르고 API 키를 입력하면 이미지에서 상품을 추출할 수 있어요.',
  authTitle: 'API 키가 거부됐어요',
  authBody:
    '제공자가 API 키를 받아들이지 않았어요. 설정에서 키를 확인하거나 바꿔 주세요.',
  rateLimitTitle: '요청이 너무 많아요',
  rateLimitBody:
    '제공자가 지금 요청을 제한하고 있어요. 잠시 후 다시 시도해 주세요.',
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
  refusedBody:
    '모델이 이 내용을 분석하지 않았어요. 정밀 모드나 다른 이미지로 시도해 보세요.',
  unavailableTitle: '서비스를 쓸 수 없어요',
  unavailableBody:
    'AI 서비스가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
  unknownTitle: '분석에 실패했어요',
  unknownBody: '분석 중에 문제가 생겼어요. 다시 시도해 주세요.',
  bridgeNotInstalledTitle: '로컬 브리지가 설치되지 않았어요',
  bridgeNotInstalledBody:
    'Claude Code나 Codex로 분석하려면 이 컴퓨터에 브리지를 설치해 주세요. 설치 방법은 설정에 있어요.',
  bridgeForbiddenTitle: '브리지가 이 확장 프로그램을 막고 있어요',
  bridgeForbiddenBody:
    '설치된 브리지가 이 확장 프로그램을 허용하지 않아요. 설정에서 설치 프로그램을 다시 실행해 주세요.',
  bridgeDisconnectedTitle: '브리지 연결이 끊겼어요',
  bridgeDisconnectedBody:
    '로컬 브리지가 예기치 않게 멈췄어요. 다시 시도해 주세요.',
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
  bridgeBusyBody:
    '로컬 CLI가 아직 다른 요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.',
  bridgeBadRequestTitle: '요청이 너무 커요',
  bridgeBadRequestBody:
    '이미지가 너무 커서 로컬 CLI로 요청을 보내지 못했어요. 이미지를 줄여서 다시 시도해 주세요.',
  bridgeInternalTitle: '브리지 오류',
  bridgeInternalBody: '로컬 브리지에서 내부 오류가 났어요. 다시 시도해 주세요.',
  cliNotInstalledTitle: 'CLI를 찾을 수 없어요',
  cliNotInstalledBody:
    'Claude Code나 Codex가 설치되지 않았거나 브리지가 찾지 못했어요. 설정을 확인해 주세요.',
  cliNotLoggedInTitle: 'CLI에 로그인해 주세요',
  cliNotLoggedInBody:
    '터미널에서 Claude Code나 Codex에 로그인한 뒤 다시 시도해 주세요.',
  cliRateLimitedTitle: 'CLI 사용 한도에 도달했어요',
  cliRateLimitedBody:
    'Claude Code나 Codex 요금제의 사용 한도를 넘었어요. 나중에 다시 시도하거나 다른 제공자로 바꿔 주세요.',
  cliTimeoutTitle: 'CLI가 너무 오래 걸렸어요',
  cliTimeoutBody:
    '로컬 CLI가 제한 시간 안에 끝내지 못했어요. 다시 시도해 주세요.',
  cliFailedTitle: 'CLI 실행에 실패했어요',
  cliFailedBody:
    '로컬 CLI가 오류로 종료됐어요. 설정에서 선택한 모델을 확인하고 다시 시도해 주세요.',
  cliBadOutputTitle: 'CLI 결과를 읽지 못했어요',
  cliBadOutputBody:
    'CLI의 답이 가격표 형식과 맞지 않았어요. 다시 시도해 주세요.',
  cliStatusCheckFailedTitle: 'CLI 상태를 확인하지 못했어요',
  cliStatusCheckFailedBody:
    '브리지가 CLI 로그인 여부를 확인하지 못했어요. 다시 시도해 주세요.',
  actionOpenSettings: '설정 열기',
  actionRetry: '다시 시도',
  actionRetryAccurate: '정밀 모드로 다시 시도',
} satisfies LocaleMessages['aiErrors'];
