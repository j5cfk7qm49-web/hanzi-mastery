import type { StudyPack, StudyItem } from '../../src/studyPacks/model';
/** Small, authored fixtures test mechanics without redistributing private class data. */
export const courseItem = (patch:Partial<StudyItem> = {}):StudyItem => ({ id:'circle-sea',section:3,mode:'circle',kind:'circle',glyph:'海',prompt:'Circle the radical inside this character.',answers:['水'],reveal:'氵 / 水 — water. Self-grade; no verified stroke mask is installed.',source:'reader + ppt',selfGrade:true,...patch });
export const coursePack = (items=[courseItem()]):StudyPack => ({schemaVersion:1,studyPackId:'test-pack',sourceVersion:'test-v1',title:'Test course',sections:[{id:3,title:'Radicals'}],items,audio:[],notes:[]});
export function syntheticHandoff():Record<string,unknown> {
  // The generated glyph/meaning pairings are synthetic, not course questions.
  const radicals=Array.from({length:57},(_,i) => ({id:`radical-${i+1}`,number:i+1,radical:String.fromCodePoint(0x4e00+i),variants:[],pinyin:'mù',meaning:'synthetic component',source_refs:['synthetic']}));
  const circles=Array.from({length:99},(_,i) => ({id:`circle-${i}`,character:String.fromCodePoint(0x5000+i),expected_radical_numbers:[1],expected_radicals:[radicals[0].radical],sources:['synthetic']}));
  return Object.fromEntries(Object.entries({
    exam_manifest:{parts:Array.from({length:7},(_,i) => ({section:i+1,title:`Section ${i+1}`}))},
    daxue_reading:{source:'synthetic',passage:[{line:1,characters:'大學之道',pinyin_syllables:['dà','xué','zhī','dào'],translation:'Great Learning'},{line:2,characters:'在明明德',pinyin_syllables:['zài','míng','míng','dé'],translation:'luminous virtue'}]},
    pinyin:{source:'synthetic',initials:['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s'],simple_finals:['a'],compound_finals:['ai'],front_nasal_finals:['an'],back_nasal_finals:['ong'],tone_patterns:[{tone:1,example:'mā',name:'level'}],mark_placement_rules:['mark a first'],spelling_rules:[{id:'spelling',input:'d+iou',output:'diu',description:'shorten'}],known_audio_issues:['no ong recording'],caveat:'synthetic'},
    radicals:{radicals},radical_recognition:{items:circles},writing:{items:[...'一二三四五六七八九十心'].map((answer,i) => ({id:`writing-${i}`,answer,prompt:`Number ${i}`,pinyin:'yī',source:'synthetic'}))},
    formations:{principles:['象形','形聲','會意','指事','假借','轉注'].map((id,i) => ({id,label:['Pictograph','Form and sound','Combined meanings','Indicating things','Borrowing','Evolving and deriving'][i]})),items:Array.from({length:16},(_,i) => ({id:`formation-${i}`,character:i===0?'想':'山',answer:i===0?'形聲':'象形',explanation:'synthetic rationale',source:'synthetic'}))},
    basic_knowledge:{source:'synthetic',items:[{id:'basic-1',question:'Elements?',acceptable_answers:['形、音、義','form, sound, meaning']},{id:'basic-2',question:'Legendary inventor?',acceptable_answers:['倉頡','Cāng Jié']},{id:'basic-3',question:'Who used 540 sections?',acceptable_answers:['許慎','Xǔ Shèn']}]},
    grammar:{source:'synthetic',word_order_types:['coordinate','modifier_modified','verb_object','subject_predicate'].map(id => ({id,label:id})),word_order_items:[{id:'order-1',text:'修行',answer:'coordinate',accepted_classifications:['coordinate','modifier_modified'],translation_example:'practice',source:'synthetic'}],empty_words:[...'之者也乎而則'].map(character => ({character,functions:['synthetic function'],examples:[{text:`${character}例`,function:'synthetic',hint:'synthetic'}]}))},
    audio_manifest:{audio_count:0,files:[]},source_manifest:{course_pdfs:[]},
  }).map(([key,value]) => [key+'.json',{schema_version:1,...value}]));
}
