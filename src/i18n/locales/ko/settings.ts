import type { LocaleMessages } from '../../define';

export default {
  title: '설정',
  colorTheme: '컬러 테마',
  language: '언어',
  exportData: '데이터 내보내기 (JSON)',
  importData: '데이터 가져오기',
  importSuccess:
    '가져오기 완료: 행사 {events}개, 부스 {booths}개, 상품 {items}개',
  importFailed: '가져오기 실패: 파일 형식을 확인해주세요',
  exportFailed: '내보내기에 실패했습니다. 다시 시도해주세요.',
} satisfies LocaleMessages['settings'];
