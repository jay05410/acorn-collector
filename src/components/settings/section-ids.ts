/** Sections of the settings screen, for deep links such as "Connect AI now". */
export type SettingsSectionId =
  | 'ai'
  | 'analysis'
  | 'appearance'
  | 'data'
  | 'about';

export function sectionElementId(id: SettingsSectionId): string {
  return `settings-${id}`;
}

export function sectionHeadingId(id: SettingsSectionId): string {
  return `settings-${id}-title`;
}
