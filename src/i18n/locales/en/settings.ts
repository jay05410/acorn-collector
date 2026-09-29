import type { MessageTable } from '../../define';

export default {
  title: 'Settings',
  colorTheme: 'Color Theme',
  language: 'Language',
  exportData: 'Export Data (JSON)',
  importData: 'Import Data',
  importSuccess:
    'Import complete. Events: {events}, booths: {booths}, items: {items}',
  importFailed: 'Import failed. Please check the file format.',
  exportFailed: 'Export failed. Please try again.',
} satisfies MessageTable;
