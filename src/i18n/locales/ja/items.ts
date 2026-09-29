import type { LocaleMessages } from '../../define';

export default {
  title: '商品リスト',
  addItem: '商品追加',
  noItems: '登録された商品がありません',
  noItemsDesc: '購入する商品を追加してください',
  itemName: '商品名',
  itemNamePlaceholder: '商品名（Enterで追加）',
  price: '価格',
  pricePlaceholder: '価格（任意）',
  quantity: '数量',
  badge: 'バッジ選択',
  newBadge: '新規バッジ名',
  extractFromImage: '画像から商品抽出',
  imageHint: '画像があります！「画像から商品抽出」で自動登録できます。',
  totalItems_one: '合計{count}個の商品',
  totalItems_other: '合計{count}個の商品',
  customQuantity: '数量を入力',
  addCustomBadge: 'カスタムバッジを追加',
  itemDeleted: '「{name}」を削除しました',
} satisfies LocaleMessages['items'];
