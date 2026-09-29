import type { LocaleMessages } from '../../define';

/** Re-analysis sheet of a saved booth (and shared analysis counters). */
export default {
  title: '상품 추출',
  analyzingImages_one: '이미지 {count}개 분석 중...',
  analyzingImages_other: '이미지 {count}개 분석 중...',
  selectedCount: '{count}개 선택됨',
  usesPostText: '저장된 게시글 내용도 함께 분석해요.',
  addCount_one: '상품 {count}개 추가',
  addCount_other: '상품 {count}개 추가',
  added_one: '상품 {count}개를 추가했어요',
  added_other: '상품 {count}개를 추가했어요',
  addFailed: '상품을 추가하지 못했어요. 다시 시도해 주세요.',
} satisfies LocaleMessages['analysis'];
