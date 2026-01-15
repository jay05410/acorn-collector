import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.VITE_KAKAO_API_KEY': JSON.stringify(
        process.env.VITE_KAKAO_API_KEY || ''
      ),
    },
  }),
  manifest: {
    name: '도토리 주머니',
    description: '행사 준비용 체크리스트 관리',
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
  },
});
