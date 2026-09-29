import type { ItemCategory } from '@/types';

export default {
  acrylic: 'Acrylic',
  keyring: 'Keyring',
  stand: 'Stand',
  poster: 'Poster',
  postcard: 'Postcard',
  sticker: 'Sticker',
  photocard: 'Photocard',
  memo: 'Memo Pad',
  tape: 'Masking Tape',
  badge: 'Badge',
  book: 'Book/Doujinshi',
  calendar: 'Calendar',
  pouch: 'Pouch',
  plush: 'Plush',
  apparel: 'Apparel',
  set: 'Set',
  digital: 'Digital',
  other: 'Other',
} satisfies Record<ItemCategory, string>;
