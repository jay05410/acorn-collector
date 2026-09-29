import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'native-host/**/*.test.mjs',
      'scripts/**/*.test.mjs',
    ],
    environment: 'node',
    // Preloads the lazily loaded locales (see the file).
    setupFiles: ['src/i18n/test-setup.ts'],
    restoreMocks: true,
  },
});
