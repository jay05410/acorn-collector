import type { Badge, PresetBadgeId } from '@/types';

/**
 * Built-in badges. `label` is only an English fallback: the UI shows preset
 * badges through getBadgeLabel(), localized by id.
 */
export const PRESET_BADGES: Record<PresetBadgeId, Badge> = {
  purchase: {
    id: 'purchase',
    label: 'Buy',
    isPreset: true,
    color: '#3b82f6',
    createdAt: 0,
  },
  pickup: {
    id: 'pickup',
    label: 'Pick up',
    isPreset: true,
    color: '#22c55e',
    createdAt: 0,
  },
  etc: {
    id: 'etc',
    label: 'Other',
    isPreset: true,
    color: '#6b7280',
    createdAt: 0,
  },
};

export const PRESET_BADGE_IDS = Object.keys(PRESET_BADGES) as PresetBadgeId[];
export const DEFAULT_BADGE_ID: PresetBadgeId = 'purchase';
