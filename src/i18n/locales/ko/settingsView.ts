import type { LocaleMessages } from '../../define';

/** The settings screen (ACORN-7): sections other than the AI connection. */
export default {
  saveFailed: '변경 사항을 저장하지 못했습니다. 다시 시도해주세요.',
  sectionAi: 'AI 연결',
  sectionAiDesc:
    '부스 이미지와 게시글을 읽을 AI 서비스를 고르세요. 내 계정으로 직접 연결되며 저희 서버를 거치지 않습니다.',
  sectionAnalysis: '분석',
  sectionAnalysisDesc: '분석 속도, 모델, 시작 시점을 정합니다.',
  sectionAppearance: '화면',
  sectionData: '데이터',
  sectionAbout: '정보',
  tierLabel: '모드',
  tierFast: '빠르게',
  tierAccurate: '정확하게',
  tierFastHint:
    '가장 빨리 결과를 받습니다. 깔끔한 가격표나 텍스트에 알맞습니다.',
  tierAccurateHint:
    '느리지만 더 강력합니다. 사진, 손글씨, 복잡한 배치에 알맞습니다.',
  tierUsesModel: '{model} 모델을 사용합니다.',
  modelLabel: '모델',
  modelDefault: '이 모드의 기본값 ({model})',
  modelCustom: '모델 ID 직접 입력...',
  modelCustomLabel: '모델 ID',
  modelCustomHint:
    '이미지를 지원하는 모델이어야 합니다. 두 모드 모두 기본 모델 대신 사용됩니다.',
  modelOverrideHint: '두 모드 모두 기본 모델 대신 이 모델을 사용합니다.',
  modelNeedsProvider: '모델을 고르려면 먼저 위에서 AI 서비스를 선택하세요.',
  cliModelLabel: 'CLI 모델',
  cliModelHintDefault: '비워 두면 {model} 모델을 사용합니다.',
  cliModelHintCodex: '비워 두면 Codex에 설정된 기본 모델을 사용합니다.',
  cliModelForeign:
    '"{model}" 모델은 {cli}에서 쓸 수 없어 기본 모델을 사용합니다.',
  autoAnalyzeLabel: '캡처 후 자동으로 분석',
  autoAnalyzeHint:
    '게시글을 캡처하면 바로 AI 분석을 시작합니다. 먼저 확인하고 싶다면 끄세요.',
  cacheLabel: '저장된 분석 결과',
  cacheHint:
    '같은 이미지를 다시 분석하면 이전 결과를 즉시 재사용합니다. 이 브라우저에만 보관됩니다.',
  clearCache: '비우기',
  clearCacheTitle: '저장된 분석 결과를 비울까요?',
  clearCacheBody:
    '부스와 상품은 그대로 남습니다. 다음에 이미지를 분석할 때 AI 서비스를 다시 호출합니다.',
  clearCacheConfirm: '결과 비우기',
  cacheCleared_one: '저장된 결과 {count}개를 지웠습니다.',
  cacheCleared_other: '저장된 결과 {count}개를 지웠습니다.',
  cacheClearFailed: '저장된 결과를 지우지 못했습니다. 다시 시도해주세요.',
  darkModeNote: '다크 모드는 브라우저나 시스템 설정을 따릅니다.',
  dataIntro:
    '행사, 부스, 상품은 이 브라우저에만 저장됩니다. 확장 프로그램을 삭제하면 함께 지워지니 가끔 백업 파일을 내보내 두세요.',
  exportDone: '백업 파일을 내려받았습니다.',
  version: '버전',
  sourceCode: '소스 코드',
  noServers:
    '계정이 필요 없습니다. 저장한 내용은 브라우저에만 남고 저희 서버에는 아무것도 저장되지 않습니다.',
} satisfies LocaleMessages['settingsView'];
