import type { MessageTable } from '../../define';

/** The settings screen (ACORN-7): sections other than the AI connection. */
export default {
  saveFailed: "Couldn't save that change. Please try again.",
  sectionAi: 'AI connection',
  sectionAiDesc:
    'Pick the AI service that reads booth images and posts. You use your own account; nothing goes through us.',
  sectionAnalysis: 'Analysis',
  sectionAnalysisDesc: 'Speed, model and when analysis starts.',
  sectionAppearance: 'Appearance',
  sectionData: 'Data',
  sectionAbout: 'About',
  tierLabel: 'Mode',
  tierFast: 'Fast',
  tierAccurate: 'Accurate',
  tierFastHint: 'Quickest results. Good for clear price lists and typed text.',
  tierAccurateHint:
    'Slower but stronger. Better for photos, handwriting and busy layouts.',
  tierUsesModel: 'Uses {model}.',
  modelLabel: 'Model',
  modelDefault: 'Default for this mode ({model})',
  modelCustom: 'Custom model ID...',
  modelCustomLabel: 'Model ID',
  modelCustomHint:
    'The model must accept images. It replaces the default in both modes.',
  modelOverrideHint: 'Replaces the default model in both modes.',
  modelNeedsProvider: 'Choose an AI service above to pick a model.',
  cliModelLabel: 'CLI model',
  cliModelHintDefault: 'Leave empty to use {model}.',
  cliModelHintCodex: "Leave empty to use Codex's own default model.",
  cliModelForeign:
    '"{model}" is not a {cli} model, so the default will be used.',
  autoAnalyzeLabel: 'Analyze automatically after capture',
  autoAnalyzeHint:
    'Starts AI analysis as soon as you capture a post. Turn off to review first.',
  cacheLabel: 'Saved analysis results',
  cacheHint:
    'Analyzing the same images again reuses earlier results instantly. Kept only in this browser.',
  clearCache: 'Clear',
  clearCacheTitle: 'Clear saved analysis results?',
  clearCacheBody:
    'Your booths and items stay. The next analysis of an image calls the AI service again.',
  clearCacheConfirm: 'Clear results',
  cacheCleared_one: 'Removed {count} saved result.',
  cacheCleared_other: 'Removed {count} saved results.',
  cacheClearFailed: "Couldn't clear saved results. Please try again.",
  darkModeNote: 'Dark mode follows your browser or system setting.',
  dataIntro:
    'Events, booths and items are saved only in this browser. Removing the extension deletes them, so export a backup from time to time.',
  exportDone: 'Backup file downloaded.',
  version: 'Version',
  sourceCode: 'Source code',
  noServers:
    'No account needed. What you save stays in your browser; nothing is stored on our servers.',
} satisfies MessageTable;
