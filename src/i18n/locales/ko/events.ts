import type { LocaleMessages } from '../../define';

export default {
  title: '행사',
  addEvent: '새 행사 추가',
  noEvents: '등록된 행사가 없습니다',
  noEventsDesc: '새로운 행사를 추가해보세요',
  eventName: '행사 이름',
  eventNamePlaceholder: '행사 이름 (예: 서코 45회)',
  eventDate: '행사 날짜',
  eventLocation: '장소',
  eventLocationPlaceholder: '장소 (예: 코엑스)',
  deleteConfirm:
    '이 행사를 삭제하시겠습니까? 포함된 모든 부스와 상품도 삭제됩니다.',
  boothCount_one: '{count}개 부스',
  boothCount_other: '{count}개 부스',
  selectDate: '날짜 선택',
  clearDate: '날짜 지우기',
} satisfies LocaleMessages['events'];
