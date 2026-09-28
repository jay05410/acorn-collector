import type { PresetBadgeId } from '@/types';
import { defineMessages } from '../define';

export default defineMessages<Record<PresetBadgeId, string>>({
  en: { purchase: 'Buy', pickup: 'Pick up', etc: 'Other' },
  ko: { purchase: '구매', pickup: '수령', etc: '기타' },
  ja: { purchase: '購入', pickup: '受け取り', etc: 'その他' },
  'zh-CN': { purchase: '购买', pickup: '领取', etc: '其他' },
  'zh-TW': { purchase: '購買', pickup: '取貨', etc: '其他' },
});
