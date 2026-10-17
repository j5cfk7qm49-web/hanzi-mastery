import type { CharacterJson } from 'hanzi-writer';
export interface CharacterOverride {
  data: CharacterJson;
  source: string;
  license: string;
  notes: string;
  moeCheckedAt?: string;
  leniency?: number;
}
/** Add only independently checked, lawfully redistributable vectors. No MOE vectors are copied here. */
export const CHARACTER_OVERRIDES: Record<string, CharacterOverride> = {};
