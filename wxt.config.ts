import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  dev: {
    server: {
      port: 3000,
    },
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.VITE_KAKAO_API_KEY': JSON.stringify(
        process.env.VITE_KAKAO_API_KEY || ''
      ),
      'import.meta.env.VITE_GOOGLE_PLACES_API_KEY': JSON.stringify(
        process.env.VITE_GOOGLE_PLACES_API_KEY || ''
      ),
    },
  }),
  manifest: ({ mode }) => ({
    content_security_policy:
      mode === 'development'
        ? {
            extension_pages:
              "script-src 'self' http://localhost:3000; object-src 'self'",
          }
        : undefined,
    name: '__MSG_appName__',
    description: '__MSG_appDescription__',
    default_locale: 'ko',
    version: '1.0.0',
    permissions: ['storage', 'contextMenus', 'activeTab', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    action: {
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  }),
});
