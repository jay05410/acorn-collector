import type { MessageTable } from '../../define';

/** Re-analysis sheet of a saved booth (and shared analysis counters). */
export default {
  title: 'Extract items',
  analyzingImages_one: 'Analyzing {count} image...',
  analyzingImages_other: 'Analyzing {count} images...',
  selectedCount: '{count} selected',
  usesPostText: 'The saved post text is analyzed too.',
  addCount_one: 'Add {count} item',
  addCount_other: 'Add {count} items',
  added_one: 'Added {count} item',
  added_other: 'Added {count} items',
  addFailed: "Couldn't add the items. Please try again.",
} satisfies MessageTable;
