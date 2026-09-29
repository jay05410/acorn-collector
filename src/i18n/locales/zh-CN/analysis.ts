import type { LocaleMessages } from '../../define';

/** Re-analysis sheet of a saved booth (and shared analysis counters). */
export default {
  title: '提取商品',
  analyzingImages_one: '正在分析{count}张图片...',
  analyzingImages_other: '正在分析{count}张图片...',
  selectedCount: '已选择 {count} 项',
  usesPostText: '已保存的帖子文字也会一起分析。',
  addCount_one: '添加 {count} 件商品',
  addCount_other: '添加 {count} 件商品',
  added_one: '已添加 {count} 件商品',
  added_other: '已添加 {count} 件商品',
  addFailed: '无法添加商品，请重试。',
} satisfies LocaleMessages['analysis'];
