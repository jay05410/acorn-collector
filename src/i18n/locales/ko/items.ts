import type { LocaleMessages } from '../../define';

export default {
  title: '상품 목록',
  addItem: '상품 추가',
  noItems: '등록된 상품이 없습니다',
  noItemsDesc: '구매/수령할 상품을 추가해보세요',
  itemName: '상품명',
  itemNamePlaceholder: '상품명 (Enter로 추가)',
  price: '가격',
  pricePlaceholder: '가격 (선택)',
  quantity: '수량',
  badge: '뱃지 선택',
  newBadge: '새 뱃지 이름',
  extractFromImage: '이미지에서 상품 추출',
  imageHint: '이미지가 있어요! "이미지에서 상품 추출"로 자동 등록이 가능해요.',
  totalItems_one: '총 {count}개 상품',
  totalItems_other: '총 {count}개 상품',
  customQuantity: '직접 입력',
  addCustomBadge: '커스텀 뱃지 추가',
  itemDeleted: '"{name}" 삭제됨',
} satisfies LocaleMessages['items'];
