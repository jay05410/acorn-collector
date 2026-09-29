import type { LocaleMessages } from '../../define';

export default {
  title: '设置',
  colorTheme: '颜色主题',
  language: '语言',
  exportData: '导出数据 (JSON)',
  importData: '导入数据',
  importSuccess: '导入完成：{events} 个活动、{booths} 个展位、{items} 件商品',
  importFailed: '导入失败，请检查文件格式。',
  exportFailed: '导出失败，请重试。',
} satisfies LocaleMessages['settings'];
