import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { PRESET_BADGES, PRESET_BADGE_IDS } from '@/constants/presetBadges';
import type { Badge, PresetBadgeId } from '@/types';

export function useBadges() {
  const customBadges = useLiveQuery(() =>
    db.badges.where('isPreset').equals(0).toArray()
  );

  const allBadges: Badge[] = [
    ...Object.values(PRESET_BADGES),
    ...(customBadges ?? []),
  ];

  const createBadge = async (label: string, color?: string): Promise<string> => {
    const id = generateId();
    await db.badges.add({
      id,
      label,
      isPreset: false,
      color: color ?? '#8b5cf6',
      createdAt: Date.now(),
    });
    return id;
  };

  const updateBadge = async (
    id: string,
    data: Partial<Pick<Badge, 'label' | 'color'>>
  ): Promise<void> => {
    if (PRESET_BADGE_IDS.includes(id as PresetBadgeId)) {
      return;
    }
    await db.badges.update(id, data);
  };

  const deleteBadge = async (id: string): Promise<void> => {
    if (PRESET_BADGE_IDS.includes(id as PresetBadgeId)) {
      return;
    }
    await db.badges.delete(id);
  };

  const getBadgeById = (id: string): Badge | undefined => {
    if (PRESET_BADGE_IDS.includes(id as PresetBadgeId)) {
      return PRESET_BADGES[id as PresetBadgeId];
    }
    return customBadges?.find((b) => b.id === id);
  };

  return {
    badges: allBadges,
    customBadges: customBadges ?? [],
    isLoading: customBadges === undefined,
    createBadge,
    updateBadge,
    deleteBadge,
    getBadgeById,
  };
}
