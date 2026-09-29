import type { LocaleMessages } from '../../define';

export default {
  title: '商品列表',
  addItem: '添加商品',
  noItems: '没有已注册的商品',
  noItemsDesc: '添加您想购买的商品',
  itemName: '商品名称',
  itemNamePlaceholder: '商品名称（按Enter添加）',
  price: '价格',
  pricePlaceholder: '价格（可选）',
  quantity: '数量',
  badge: '选择徽章',
  newBadge: '新徽章名称',
  extractFromImage: '从图片提取',
  imageHint: '有可用图片！使用"从图片提取"可自动登记商品。',
  totalItems_one: '共{count}件商品',
  totalItems_other: '共{count}件商品',
  customQuantity: '自定义数量',
  addCustomBadge: '添加自定义徽章',
  itemDeleted: '已删除“{name}”',
} satisfies LocaleMessages['items'];
