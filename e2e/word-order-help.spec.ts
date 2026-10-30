import {test,expect} from '@playwright/test';
import {openSdkWidget} from './sdk-host';
import {courseItem,coursePack} from '../tests/helpers/course-pack';
for(const width of [786,393])test(`word-order Pinyin and meanings are visible before answering at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:852});
  const item=courseItem({id:'order',section:7,kind:'choice',mode:'word-order',glyph:'水火木金土',syllables:['shuǐ','huǒ','mù','jīn','tǔ'],glosses:['water','fire','wood','metal; gold','earth; soil'],prompt:'Classify the word order.',choices:['Coordinate','Verb–object'],answers:['Coordinate'],reveal:'Model translation: the five elements'}),pack=coursePack([item]);pack.sections=[{id:7,title:'Grammar and translation'}];
  const host=await openSdkWidget(page,'study_packs',{coursePack:pack,popupLayout:true,pausedStudyCards:true}),ui=host.frame;await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
  await expect(ui.locator('rt')).toHaveText(item.syllables!);for(const meaning of item.glosses!)await expect(ui.getByText(meaning,{exact:true})).toBeVisible();await expect(ui.getByText(item.reveal,{exact:true})).toHaveCount(0);
  expect(await ui.locator('.hm-study-packs').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await ui.getByRole('button',{name:'Coordinate',exact:true}).click();await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();await expect(ui.getByText(item.reveal,{exact:true})).toBeVisible();await ui.getByRole('button',{name:'Save result and next',exact:true}).click();await expect(ui.getByRole('heading',{name:'Session complete',exact:true})).toBeVisible();
  expect(host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus')).toHaveLength(1);expect(host.calls.some(c=>/setEnablePractice|delete/.test(c.methodName))).toBe(false);expect(host.errors).toEqual([]);
});
