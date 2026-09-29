import type { LocaleMessages } from '../../define';

/** Re-analysis sheet of a saved booth (and shared analysis counters). */
export default {
  title: '擷取商品',
  analyzingImages_one: '正在分析 {count} 張圖片…',
  analyzingImages_other: '正在分析 {count} 張圖片…',
  selectedCount: '已選 {count} 項',
  usesPostText: '已儲存的貼文文字也會一起分析。',
  addCount_one: '新增 {count} 件商品',
  addCount_other: '新增 {count} 件商品',
  added_one: '已新增 {count} 件商品',
  added_other: '已新增 {count} 件商品',
  addFailed: '無法新增商品，請重試。',
} satisfies LocaleMessages['analysis'];
