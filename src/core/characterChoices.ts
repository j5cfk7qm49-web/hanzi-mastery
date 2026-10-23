import { polyphonic } from 'pinyin-pro';
import { parsePinyin, shuffleChoices, validateReading, type CharacterChoice } from './recall';

interface ReadingGroup { entry: CharacterChoice; readings: Set<string>[]; invalid: boolean }
// A small bundled vocabulary pool supplies missing distractors for existing cards.
// Every candidate still goes through all-reading ambiguity checks below.
const fallbackChoices: CharacterChoice[] = [
  ['人','rén'], ['書','shū'], ['愛','ài'], ['國','guó'], ['山','shān'], ['水','shuǐ'], ['火','huǒ'], ['木','mù'],
  ['學生','xué shēng'], ['老師','lǎo shī'], ['朋友','péng yǒu'], ['明天','míng tiān'], ['今天','jīn tiān'], ['學校','xué xiào'],
  ['圖書館','tú shū guǎn'], ['計程車','jì chéng chē'], ['自行車','zì xíng chē'], ['電影院','diàn yǐng yuàn'],
].map(([traditional, pinyin]) => ({ traditional, pinyin }));
/** Conservative per-character combinations also cover alternate readings absent from saved vocabulary. */
function dictionaryReadings(text: string): Set<string>[] {
  return polyphonic(text, { type: 'array', toneType: 'none' }).map(readings => new Set(readings.map(reading => {
    const syllables = parsePinyin(reading);
    if (syllables.length !== 1) throw new Error('Unverified dictionary reading.');
    return syllables[0].base;
  })));
}
function overlaps(left: ReadingGroup, right: ReadingGroup): boolean {
  return left.readings.length === right.readings.length && left.readings.every((options, i) =>
    [...options].some(base => right.readings[i].has(base)));
}
/** Use dictionary and learner-specified readings only to exclude ambiguity; never replace the intended reading. */
export function buildCharacterChoices(target: CharacterChoice, vocabulary: CharacterChoice[], random = Math.random): CharacterChoice[] {
  validateReading(target);
  const groups = new Map<string, ReadingGroup>();
  for (const entry of [...vocabulary, target, ...fallbackChoices]) {
    if (!entry || typeof entry.traditional !== 'string') continue;
    let group = groups.get(entry.traditional);
    if (!group) {
      group = { entry, readings: [], invalid: false };
      groups.set(entry.traditional, group);
      try { group.readings = dictionaryReadings(entry.traditional); }
      catch { group.invalid = true; }
    }
    try {
      validateReading(entry);
      parsePinyin(entry.pinyin).forEach((s, i) => group!.readings[i].add(s.base));
    } catch { group.invalid = true; }
  }
  const targetGroup = groups.get(target.traditional)!;
  if (targetGroup.invalid) throw new Error('This target or one of its recorded readings could not be verified for character choices. Check its vocabulary metadata and dictionary coverage.');
  const selected = [targetGroup];
  const choices: CharacterChoice[] = [{ traditional: target.traditional, pinyin: target.pinyin }];
  const recorded = new Set(vocabulary.map(entry => entry?.traditional));
  const candidates = [...shuffleChoices([...groups.values()].filter(g => recorded.has(g.entry.traditional)), random),
    ...shuffleChoices([...groups.values()].filter(g => !recorded.has(g.entry.traditional)), random)];
  for (const group of candidates) {
    if (group.invalid || group.entry.traditional === target.traditional ||
        group.readings.length !== targetGroup.readings.length || selected.some(old => overlaps(group, old))) continue;
    choices.push({ traditional: group.entry.traditional, pinyin: group.entry.pinyin });
    selected.push(group);
    if (choices.length === 4) break;
  }
  if (choices.length < 4) throw new Error('Add at least three Hanzi Vocabulary entries with the same number of characters and distinct pinyin before creating this card. Four verified choices are required; homophones and tone-only differences are excluded.');
  return choices;
}
