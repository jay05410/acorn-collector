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
    default_locale: 'en',
    version: '1.0.0',
    permissions: [
      'storage',
      'contextMenus',
      'activeTab',
      'sidePanel',
      'identity',
      'scripting',
    ],
    // Requested at runtime when the user turns on the local CLI bridge.
    optional_permissions: ['nativeMessaging'],
    // Development builds get a fixed extension ID (elmococmlnkhkpegnjnoflakfnakhcdn)
    // so the native host's allowlist can name it; see
    // native-host/scripts/gen-dev-key.mjs. Production builds keep the store ID.
    ...(mode === 'development'
      ? {
          key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp5Y7OQMVgKhjfv7Uf4MwXyI/WBrZ2xlmzp71ITa9KupudsbbZx8iSfPSnYVQZjSO43NhocvVydF8oPa2gZnR6V0PkHOlmPGvc80d5D7RTTj9fl+iurH2Up1H0iVzdLrHxkU0O1COOrZkSitqhuTUKVofGnERgHHOGeGgCzi6GDz7x1MXpPohFd3nzlpMuTr7NkoHJJsatgteaEvVQMv9m3re9ALzre3n+SpU0r7den9faKjFbrTyrlAoHgPwSFQ4WITRs+aHcbaE1WBtOA8R7Ek7V1smaKi/dMZsRQnA1fVsZsuAVYlblO90/yNxnawxHzrkyxmF0tKrNJL7A4dyhwIDAQAB',
        }
      : {}),
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
    commands: {
      'capture-page': {
        suggested_key: { default: 'Alt+Shift+A' },
        description: '__MSG_commandCapture__',
      },
    },
  }),
});
