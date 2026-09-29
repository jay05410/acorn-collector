import type { LocaleMessages } from '../../define';

/** Re-analysis sheet of a saved booth (and shared analysis counters). */
export default {
  title: '商品を抽出',
  analyzingImages_one: '画像{count}枚を分析中...',
  analyzingImages_other: '画像{count}枚を分析中...',
  selectedCount: '{count}個選択中',
  usesPostText: '保存済みの投稿本文も一緒に分析します。',
  addCount_one: '商品{count}件を追加',
  addCount_other: '商品{count}件を追加',
  added_one: '商品を{count}件追加しました',
  added_other: '商品を{count}件追加しました',
  addFailed: '商品を追加できませんでした。もう一度お試しください。',
} satisfies LocaleMessages['analysis'];
