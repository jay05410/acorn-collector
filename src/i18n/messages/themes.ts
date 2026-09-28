import type { ColorTheme } from '@/lib/settings-types';
import { defineMessages } from '../define';

export default defineMessages<Record<ColorTheme, string>>({
  en: { acorn: 'Acorn', pink: 'Pink', sky: 'Sky', lavender: 'Lavender' },
  ko: { acorn: '도토리', pink: '분홍', sky: '하늘', lavender: '연보라' },
  ja: {
    acorn: 'どんぐり',
    pink: 'ピンク',
    sky: 'スカイ',
    lavender: 'ラベンダー',
  },
  'zh-CN': { acorn: '橡果', pink: '粉红', sky: '天蓝', lavender: '薰衣草' },
  'zh-TW': { acorn: '橡實', pink: '粉紅', sky: '天藍', lavender: '薰衣草' },
});
