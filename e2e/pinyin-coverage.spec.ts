import {test,expect} from '@playwright/test';
import {openSdkWidget} from './sdk-host';
import {courseItem,coursePack} from '../tests/helpers/course-pack';

const sounds=[
  courseItem({id:'spoken-final',section:2,mode:'sound-recognition',kind:'oral',glyph:'ai',answers:['ai'],showPinyin:false,prompt:'Pronounce the final.',audioId:'reference'}),
  courseItem({id:'heard-consonant',section:2,mode:'dictation',kind:'text',glyph:undefined,input:'pinyin',answers:['d'],prompt:'Listen and type the consonant.',audioId:'reference'}),
  courseItem({id:'heard-group',section:2,mode:'dictation',kind:'text',glyph:undefined,input:'pinyin',answers:['b p m f'],prompt:'Listen and type each consonant once in order, separated by spaces.',reveal:'The reference contains the group b, p, m, f.',audioId:'reference'}),
];
for(const item of sounds)for(const width of [786,393])test(`Pinyin course ${item.id} at ${width}px`,async({page,browserName})=>{
  await page.setViewportSize({width,height:852});
  const pack={...coursePack([item]),sections:[{id:2,title:'Pinyin'}],audio:[{id:'reference',path:'fixture.wav',bytes:16044,sha256:'a'.repeat(64),url:process.env.HANZI_NATIVE_QUEUE_AUDIO_URL || 'https://hanzi-plugin.test/fixture.wav'}]};
  const host=await openSdkWidget(page,'study_packs',{coursePack:pack,pausedStudyCards:true,popupLayout:true}),ui=host.frame;
  await expect(ui.getByRole('option',{name:item.kind==='oral'?'Pronunciation':'Listening / dictation',exact:true})).toHaveCount(1);
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
  if(item.kind==='oral'){
    await expect(ui.getByLabel('Private course reference')).toHaveCount(0);await ui.getByRole('button',{name:"I've read aloud — compare",exact:true}).click();
  }else{await expect(ui.getByText(item.answers[0],{exact:true})).toHaveCount(0);await expect(ui.locator('.hm-pack-glyph')).toHaveCount(0);}
  const audio=ui.getByLabel('Private course reference');await ui.getByRole('button',{name:'Play course reference',exact:true}).click();
  try{await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.ended),{timeout:browserName==='webkit'?5000:15000}).toBe(true);}
  catch(e){
    if(browserName!=='webkit')throw e;
    test.info().annotations.push({type:'codec-limitation',description:'Windows WebKit could not finish synthetic fixture media; verified blocked grading and no-result skip.'});
    await expect(ui.getByRole('button',{name:item.kind==='oral'?'I got it':'Submit and reveal',exact:true})).toBeDisabled();
    await ui.getByRole('button',{name:item.kind==='oral'?'Skip reading (no result)':'Skip audio activity (no result)',exact:true}).click();
    expect(host.calls.some(c=>c.methodName==='card.updateCardRepetitionStatus')).toBe(false);return;
  }
  if(item.kind!=='oral'){await ui.getByLabel('Your pinyin').fill(item.answers[0]);await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();}
  await ui.getByRole('button',{name:'I got it',exact:true}).click();await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible();
  expect(host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus')).toHaveLength(1);expect(host.errors).toEqual([]);
  expect(host.calls.some(c=>/setEnablePractice|setPracticeDirection|delete/.test(c.methodName))).toBe(false);
});

for(const queueStyle of ['compact','beautiful'] as const)for(const item of sounds)test(`Pinyin normal ${queueStyle} queue ${item.id}`,async({page,browserName})=>{
  await page.setViewportSize({width:393,height:852});
  const host=await openSdkWidget(page,'recall_review',{nativeMode:true,queueStyle,nativeQueueSkill:'listening',nativeQueueItem:item,nativeQueueAudioUrl:process.env.HANZI_NATIVE_QUEUE_AUDIO_URL}),ui=host.nativeRoot;
  await ui.getByRole('button',{name:item.kind==='oral'?'Begin spoken practice':'Begin recall test',exact:true}).click();
  if(item.kind==='oral'){
    await expect(ui.getByRole('button',{name:'Play reference audio',exact:true})).toHaveCount(0);
    await ui.getByRole('button',{name:'I’ve said it — compare with reference',exact:true}).click();
  }else{await expect(ui.getByText(item.answers[0],{exact:true})).toHaveCount(0);await expect(ui.locator('.hm-target,.hm-result-reading')).toHaveCount(0);}
  if(item.kind!=='oral')await ui.getByLabel('Your pinyin').fill(item.answers[0]);
  const accept=ui.getByRole('button',{name:item.kind==='oral'?'I pronounced it correctly':'Check first answer',exact:true});
  await expect(accept).toBeDisabled();
  await ui.getByRole('button',{name:'Play reference audio',exact:true}).click();
  try{await expect(accept).toBeEnabled({timeout:browserName==='webkit'?5000:15000});}
  catch(e){if(browserName!=='webkit')throw e;await expect(accept).toBeDisabled();test.info().annotations.push({type:'codec-limitation',description:'Native Windows WebKit fixture media did not complete; grading stays blocked.'});return;}
  await accept.click();
  await expect(ui.getByLabel('Result saved')).toBeVisible();await expect(ui.locator('.hm-outcome.hm-pass')).toBeVisible();
  expect(await ui.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(host.errors).toEqual([]);
  expect(host.calls.some(c=>/updateCardRepetitionStatus|setEnablePractice|setPracticeDirection|createRem/.test(c.methodName))).toBe(false);
});
