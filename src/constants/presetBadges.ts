import type { Badge, PresetBadgeId } from '@/types';

export const PRESET_BADGES: Record<PresetBadgeId, Badge> = {
  purchase: {
    id: 'purchase',
    label: '구매',
    isPreset: true,
    color: '#3b82f6',
    createdAt: 0,
  },
  pickup: {
    id: 'pickup',
    label: '수령',
    isPreset: true,
    color: '#22c55e',
    createdAt: 0,
  },
  etc: {
    id: 'etc',
    label: '기타',
    isPreset: true,
    color: '#6b7280',
    createdAt: 0,
  },
};

export const PRESET_BADGE_IDS = Object.keys(PRESET_BADGES) as PresetBadgeId[];
export const DEFAULT_BADGE_ID: PresetBadgeId = 'purchase';
