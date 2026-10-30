import type { StudyPack, StudyItem } from './model';
import { toneSyllable } from '../core/pinyinInput';
import {wordOrderHelp} from './wordOrderHelp';
import {particleHelp} from './particleHelp';

type Row = Record<string, unknown>;
export function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value as Row;
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 12000) throw new Error('Missing or invalid text.');
  return value;
}
export function list(value: unknown): unknown[] { if (!Array.isArray(value) || value.length > 2000) throw new Error('Invalid collection.'); return value; }
const rows = (value: unknown) => list(value).map(object);
const strings = (value: unknown) => list(value).map(text);
const s = (row: Row, key: string) => text(row[key]);
const optional = (value: unknown) => value === undefined ? '' : text(value);
const source = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);
function expect(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Course pack: ${message}`); }

/** Convert the supplied private format at the boundary; reusable exercise UI stays course-independent. */
export function compileClassicalChinese(files: Record<string, unknown>): StudyPack {
  const get = (name: string) => { const row = object(files[name + '.json']); expect(row.schema_version === 1, `unsupported ${name} schema`); return row; };
  const exam = get('exam_manifest'), reading = get('daxue_reading'), pinyin = get('pinyin'), radicals = rows(get('radicals').radicals);
  const circles = rows(get('radical_recognition').items), writing = rows(get('writing').items), formation = get('formations');
  const facts = get('basic_knowledge'), grammar = get('grammar'), manifest = get('audio_manifest'), sources = get('source_manifest');
  expect(rows(exam.parts).map(p => p.section).join() === '1,2,3,4,5,6,7', 'seven ordered sections required');
  expect(radicals.length === 57 && radicals.every((r, i) => r.number === i + 1), '57 numbered radicals required');
  expect(circles.length === 99 && new Set(circles.map(r => r.character)).size === 99, '99 distinct circle examples required');
  expect(writing.map(w => w.answer).join('') === '一二三四五六七八九十心', 'only the 11 exam writing targets are allowed');
  expect(rows(formation.principles).map(p => p.id).sort().join() === ['象形','形聲','會意','指事','假借','轉注'].sort().join(), 'six principles required');
  expect(rows(formation.items).length === 16 && rows(formation.items).some(f => f.character === '想' && f.answer === '形聲'), 'formation scope or 想 classification invalid');
  expect(rows(facts.items).length === 3 && strings(pinyin.initials).length === 21, 'facts or initials scope invalid');
  expect(rows(grammar.word_order_types).length === 4 && rows(grammar.empty_words).map(w => w.character).join('') === '之者也乎而則', 'grammar scope invalid');
  const passage=rows(reading.passage);
  expect(passage.length>=2 && passage[0].characters==='大學之道' && passage[1].characters==='在明明德', '大學 reading must start with the assigned opening');
  expect(passage.every((line,i)=>line.line===i+1 && /^\p{Script=Han}+$/u.test(s(line,'characters'))), 'reading lines must be numbered in order with Han characters only');
  rows(sources.course_pdfs).forEach(p => { s(p, 'filename'); expect(/^[a-f0-9]{64}$/.test(s(p,'sha256')), 'invalid source checksum'); });
  const items: StudyItem[] = [];
  const add = (item: StudyItem) => { expect(!items.some(i => i.id === item.id), `duplicate item ID ${item.id}`); items.push(item); };
  const audio = rows(manifest.files).map(a => {
    expect(typeof a.bytes === 'number' && a.bytes > 0 && a.bytes < 10 * 1024 * 1024, 'invalid audio size');
    expect(/^[a-f0-9]{64}$/.test(s(a,'sha256')), 'invalid audio checksum');
    return { id: s(a,'id'), path: s(a,'relative_path'), sha256: s(a,'sha256'), bytes: a.bytes as number };
  });
  expect(new Set(audio.map(a => a.id)).size === audio.length && audio.length === manifest.audio_count, 'duplicate audio IDs or count mismatch');
  const shortReading = rows(manifest.files).find(a => a.original_name === 'Dàxué zhī dào zài míngmíng dé.m4a');
  passage.forEach(line => {
    const glyph = s(line,'characters'), syllables = strings(line.pinyin_syllables);
    expect([...glyph].length === syllables.length, 'oral syllable count mismatch');
    const clip=line.audio_name===undefined ? (Number(line.line)<=2 ? shortReading : undefined) : rows(manifest.files).find(a=>a.original_name===s(line,'audio_name') && a.type==='reading');
    expect(line.audio_name===undefined || clip, 'explicit reading recording is unavailable');
    add({ id: `oral-${line.line}`, section: 1, mode: 'reading', kind: 'oral', prompt: `大學 line ${line.line}: read aloud with Pinyin.`, glyph, syllables, showPinyin:true,
      answers: [syllables.join(' ')], reveal: s(line,'translation')+(line.audio_note===undefined ? '' : ' '+s(line,'audio_note')), source: line.source===undefined ? s(reading,'source') : s(line,'source'), selfGrade: true, audioId: clip && s(clip,'id') });
  });
  if(reading.memorization!==undefined) {
    const memory=object(reading.memorization);
    add({id:s(memory,'id'),section:1,mode:'memorization',kind:'text',prompt:s(memory,'prompt'),answers:[s(memory,'characters'),s(memory,'pinyin')],
      reveal:s(memory,'note'),source:s(reading,'source'),selfGrade:true});
  }
  const soundGroups = ['initials','simple_finals','compound_finals','front_nasal_finals','back_nasal_finals'];
  // Categories organize the source; examination practice asks for sounds, not category names.
  soundGroups.forEach(group=>strings(pinyin[group]));
  const recordings=rows(manifest.files).filter(a=>a.type==='pinyin');
  const soundRecording=(sound:string)=>recordings.find(a=>[sound,sound==='iou'?'iou(iu)':sound,sound==='üe'?'ǖe':sound].includes(String(a.label)));
  const consonants=strings(pinyin.initials), groupRecording=recordings.find(a=>a.label==='b p m f');
  const groupNeeded=groupRecording && ['b','p','m','f'].every(c=>consonants.includes(c)) && ['b','p','m','f'].some(c=>!soundRecording(c));
  consonants.forEach(sound=>{
    const match=soundRecording(sound);
    const grouped=!match && groupRecording && ['b','p','m','f'].includes(sound) ? groupRecording : undefined;
    add({id:`sound-initial-${sound}`,section:2,mode:'sound-recognition',kind:'oral',glyph:sound,showPinyin:false,
      prompt:'Pronounce this Pinyin consonant.',answers:[sound],audioId:match ? s(match,'id') : grouped ? s(grouped,'id') : undefined,
      reveal:grouped ? 'The instructor reference contains the group b, p, m, f; compare the requested consonant within that group.' : 'Compare the consonant sound with the instructor reference.',
      source:s(pinyin,'source'),selfGrade:true});
    if(match)add({id:`dictation-initial-${sound}`,section:2,mode:'dictation',kind:'text',
      prompt:'Listen, then type the consonant you heard.',answers:[sound],audioId:s(match,'id'),
      reveal:'Compare the supplied classroom consonant sound with your transcription.',source:s(pinyin,'source'),selfGrade:true});
  });
  if(groupNeeded)add({id:'dictation-initial-b-p-m-f',section:2,mode:'dictation',kind:'text',
    prompt:'Listen to the group, then type each consonant once in the order first heard. Separate them with spaces.',answers:['b p m f'],audioId:s(groupRecording!,'id'),
    reveal:'The supplied classroom recording introduces the group b, p, m, f. Write the four consonant labels in that order, separated by spaces.',source:s(pinyin,'source'),selfGrade:true});
  rows(pinyin.tone_patterns).forEach(t => {
    expect(typeof t.tone === 'number' && t.tone >= 0 && t.tone <= 4, 'invalid tone');
    add({ id:`tone-${t.tone}`, section:2, mode:'tones', kind:'choice', prompt:`Identify the tone: ${s(t,'example')}`, answers:[String(t.tone)], choices:['1','2','3','4','0'],
      reveal:`${t.tone}: ${s(t,'name')}. 0 means neutral.`, source:s(pinyin,'source') });
  });
  ['ma','mei','ou','liu','gui','xue','hao'].forEach(base => [1,2,3,4].forEach(tone => add({ id:`mark-${base}-${tone}`, section:2, mode:'mark-placement', kind:'text',
    prompt:`Place tone ${tone} on ${base}.`, answers:[toneSyllable(base,tone)], reveal:strings(pinyin.mark_placement_rules).join('; '), source:s(pinyin,'source') })));
  rows(pinyin.spelling_rules).forEach(rule => add({ id:s(rule,'id'), section:2, mode:'spelling', kind:'text', prompt:`Apply the spelling rule: ${s(rule,'input')}`,
    answers:[s(rule,'output')], reveal:s(rule,'description'), source:s(pinyin,'source') }));
  soundGroups.slice(1).forEach(group => strings(pinyin[group]).forEach(sound => {
    const match = soundRecording(sound);
    // Add the missing spoken counterpart only when its authored reference exists.
    // The known unavailable ong recording remains an explicit dictation limitation.
    if(match)add({id:`sound-final-${sound}`,section:2,mode:'sound-recognition',kind:'oral',glyph:sound,showPinyin:false,
      prompt:'Pronounce this Pinyin vowel or final.',answers:[sound],audioId:s(match,'id'),
      reveal:'Compare the vowel or final sound with the instructor reference.',source:s(pinyin,'source'),selfGrade:true});
    add({ id:`dictation-${sound}`, section:2, mode:'dictation', kind:'text', prompt:'Listen, then type the vowel or final you heard.', answers:sound === 'iou' ? ['iou','iu'] : sound === 'uei' ? ['uei','ui'] : sound === 'uen' ? ['uen','un'] : [sound],
      audioId:match && s(match,'id'), reveal:'Compare the supplied classroom sound with your transcription. This is a sound label, not automatic acoustic tone assessment.', source:s(pinyin,'source'), selfGrade:true });
  }));
  radicals.forEach(r => add({ id:s(r,'id'), section:3, mode:'radical-identity', kind:'text', glyph:s(r,'radical'), prompt:'Recall the radical’s Pinyin and meaning.',
    answers:[s(r,'pinyin')], reveal:`${s(r,'radical')} ${s(r,'pinyin')} — ${s(r,'meaning')}. Variants: ${strings(r.variants).join(' / ') || 'none listed'}.` + (r.radical==='疒' ? ' The Reader also lists nè alongside chuáng; compare with your instructor’s preferred radical name.' : ''), source:source(r.source_refs), selfGrade:true }));
  circles.forEach(c => {
    expect([...s(c,'character')].length === 1, 'circle example must be one whole character');
    const numbers = list(c.expected_radical_numbers);
    expect(numbers.length > 0 && numbers.every(n => Number.isInteger(n) && radicals.some(r => r.number === n)), 'unresolvable circle radical');
    const answers = numbers.map(n => radicals.find(r => r.number === n)!);
    expect(strings(c.expected_radicals).every(a => answers.some(r => r.radical === a || strings(r.variants).includes(a))), 'circle radical text/number mismatch');
    const target=optional(c.writing_radical) || s(answers[0],'radical');
    expect([...target].length===1, 'radical writing needs one glyph');
    add({ id:s(c,'id'), section:3, mode:'radical-writing', kind:'writing', glyph:target, referenceGlyph:s(c,'character'), prompt:c.writing_radical ? 'Write the radical by itself.' : 'Write the radical in its canonical form.', answers:[target],
      reveal: answers.map(r => `${s(r,'radical')}${strings(r.variants).length ? ' / ' + strings(r.variants).join(' / ') : ''} — ${s(r,'meaning')}`).join('; ') + (c.character==='問' ? ' Source ambiguity: the course radical table assigns 門; the Reader’s later positions table also uses inner 口 for 問. This exercise follows the supplied course target, not a universal dictionary indexing claim.' : ''),
      source:strings(c.sources).join(' + ') });
  });
  radicals.forEach(r=>add({id:`meaning-${s(r,'id')}`,section:3,mode:'radical-meaning',kind:'text',glyph:s(r,'radical'),
    prompt:'Recall the radical’s English meaning.',answers:[s(r,'meaning')],reveal:s(r,'meaning'),source:source(r.source_refs),selfGrade:true}));
  writing.forEach(w => add({ id:s(w,'id'), section:4, mode:'writing', kind:'writing', prompt:s(w,'prompt'), glyph:s(w,'answer'), answers:[s(w,'answer')], reveal:s(w,'pinyin'), source:s(w,'source') }));
  writing.forEach(w=>add({id:`lookup-${s(w,'id')}`,section:4,mode:'dictionary-lookup',kind:'text',glyph:s(w,'answer'),
    prompt:'Find this assigned character in your dictionary.',answers:[`Located the dictionary entry for ${s(w,'answer')}.`],
    reveal:'Check that the entry matches the displayed character. This is an actual lookup task; no written procedure explanation is required.',
    source:'2026 Fall Midterm Exam Coverage.pdf p.3; assigned 一–十 and 心',selfGrade:true}));
  const principles = rows(formation.principles), formationLabels=principles.map(p=>s(p,'label'));
  rows(formation.items).forEach(f => { const principle=principles.find(p=>p.id===f.answer);expect(principle, 'invalid formation answer'); add({ id:s(f,'id'), section:5, mode:'formation', kind:'choice', prompt:'Choose the character formation type.', glyph:s(f,'character'),
    answers:[s(principle,'label')], choices:formationLabels, reveal:s(f,'answer')+' — '+s(f,'explanation') + (f.character === '想' ? ' Classification confirmed separately; method absent from original slide.' : f.classification_basis === 'course_teaching_classification' ? ' Classroom teaching classification for this exam; not a general historical claim.' : ''), source:source(f.source) }); });
  rows(facts.items).forEach(f => add({ id:s(f,'id'), section:6, mode:'facts', kind:'text', prompt:s(f,'question'), answers:strings(f.acceptable_answers),
    reveal: f.id === 'basic-3' ? '許慎 Xǔ Shèn organized Chinese characters into 540 sections.' : optional(f.note), source:s(facts,'source') }));
  const orders = rows(grammar.word_order_types), labels = orders.map(o => s(o,'label'));
  rows(grammar.word_order_items).forEach(w => {
    const accepted = w.accepted_classifications === undefined ? [s(w,'answer')] : strings(w.accepted_classifications);
    expect(accepted.every(a => orders.some(o => o.id === a)), 'invalid word order');
    const help=w.pinyin_syllables===undefined && w.character_meanings===undefined ? {} : {syllables:strings(w.pinyin_syllables),glosses:strings(w.character_meanings)};
    wordOrderHelp({glyph:s(w,'text'),...help});
    add({ id:s(w,'id'), section:7, mode:'word-order', kind:'choice', glyph:s(w,'text'), prompt:'Classify the word order.', choices:labels,
      answers:accepted.map(a => s(orders.find(o => o.id === a)!,'label')), reveal:optional(w.classification_note) || 'Compare the relation between the words.', source:s(w,'source'),...help });
    add({ id:`translate-${s(w,'id')}`, section:7, mode:'translation', kind:'text', glyph:s(w,'text'), prompt:'Translate into reasonable English.', answers:[s(w,'translation_example')], reveal:'Model answer. Equivalent translations are accepted through self-assessment.', source:s(w,'source'), selfGrade:true });
  });
  rows(grammar.empty_words).forEach(word => rows(word.examples).forEach((e,index) => {
    const context=e.context_hints===undefined ? {} : {targetParticle:s(word,'character'),contextHints:rows(e.context_hints).map(h=>({text:s(h,'text'),pinyin:s(h,'pinyin'),meaning:s(h,'meaning')}))};
    particleHelp({glyph:s(e,'text'),...context});
    add({ id:`particle-${s(word,'character')}-${index}`, section:7, mode:'particles', kind:'text', glyph:s(e,'text'), prompt:`Identify the function of ${s(word,'character')} in this example.`,
      answers:[s(e,'function').replaceAll('_',' ')], reveal:strings(word.functions).join('; ') + `. Model translation: ${s(e,'hint')}`, source:s(grammar,'source'), selfGrade:true,...context });
  }));
  items.filter(i=>i.section===2).forEach(i=>{i.input='pinyin';});
  return { schemaVersion:1, studyPackId:'classical-chinese-i-2026-midterm', sourceVersion:'2026-10-24-v1', title:'Classical Chinese I · Midterm (Oct 30, 2026)',
    sections:rows(exam.parts).map(p => ({ id:p.section as number, title:s(p,'title') })), items, audio,
    notes:[...strings(pinyin.known_audio_issues), s(pinyin,'caveat'), 'Translation and oral results are self-assessments. Radical writing uses the existing handwriting grader. Recordings can be attached in RemNote for access from other devices; local ZIP audio is a fallback.'] };
}
