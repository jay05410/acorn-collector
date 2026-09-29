import type { LocaleMessages } from '../../define';

export default {
  title: '商品清單',
  addItem: '新增商品',
  noItems: '尚未新增任何商品',
  noItemsDesc: '新增想購買或領取的商品吧',
  itemName: '商品名稱',
  itemNamePlaceholder: '商品名稱（按 Enter 新增）',
  price: '價格',
  pricePlaceholder: '價格（選填）',
  quantity: '數量',
  badge: '選擇標籤',
  newBadge: '新標籤名稱',
  extractFromImage: '從圖片擷取商品',
  imageHint: '有圖片！可以使用「從圖片擷取商品」自動新增。',
  totalItems_one: '共 {count} 件商品',
  totalItems_other: '共 {count} 件商品',
  customQuantity: '自訂數量',
  addCustomBadge: '新增自訂標籤',
  itemDeleted: '已刪除「{name}」',
} satisfies LocaleMessages['items'];
