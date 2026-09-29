import type { PresetBadgeId } from '@/types';

export default {
  purchase: 'Buy',
  pickup: 'Pick up',
  etc: 'Other',
} satisfies Record<PresetBadgeId, string>;
