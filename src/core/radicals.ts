/** Audio aliases only. Written targets, dictionary records and card identities stay exact. */
const audioBases: Readonly<Record<string, readonly string[]>> = {
  '亻': ['人'], '忄': ['心'], '扌': ['手'], '氵': ['水'], '灬': ['火'],
  '衤': ['衣'], '耂': ['老'], '巛': ['川'], '⺮': ['竹'], '⺼': ['肉'],
  '艹': ['艸', '草'], '艸': ['草'], '糹': ['糸'], '辶': ['辵'],
  // Position determines the parent; the saved reading must match the selected clip.
  '阝': ['阜', '邑'],
};

export function radicalAudioBases(form: string): readonly string[] {
  return audioBases[form] || [];
}
