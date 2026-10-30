import {test,expect} from '@playwright/test';
import {courseItem,coursePack} from '../tests/helpers/course-pack';
import {openSdkWidget} from './sdk-host';

const sections=['Oral reading','Pinyin sound/spelling','Radical and Pinyin','Writing','Six composition principles','Basic knowledge','Grammar and translation'].map((title,i)=>({id:i+1,title}));
const order=courseItem({id:'order',section:7,mode:'word-order',kind:'choice',prompt:'Classify the word order.',glyph:'父母',syllables:['fù','mǔ'],glosses:['father','mother'],answers:['Coordinate'],choices:['Coordinate','Modifier–head','Subject–predicate','Verb–object'],reveal:'Coordinate: parents.'});
const pack={...coursePack([order,...sections.slice(0,6).map(s=>courseItem({id:`section-${s.id}`,section:s.id,kind:'text',mode:'recall',glyph:undefined,prompt:'Recall the course fact.',answers:['answer'],selfGrade:false}))]),title:'Classical Chinese I · Midterm',sections};

for(const [width,colorScheme] of [[320,'light'],[393,'light'],[786,'light'],[393,'dark']] as const)test(`course dashboard and answer controls fit ${width}px ${colorScheme}`,async({page})=>{
  await page.setViewportSize({width,height:852});await page.emulateMedia({colorScheme});
  const host=await openSdkWidget(page,'study_packs',{coursePack:pack,popupLayout:true}),ui=host.frame;
  await expect(ui.getByRole('heading',{name:'Midterm review'})).toBeVisible();
  await expect(ui.getByRole('button',{name:'Practice missed',exact:true})).toBeDisabled();
  const fits=()=>ui.locator('.hm-study-packs').evaluate(el=>el.scrollWidth<=el.clientWidth+1);
  expect(await fits()).toBe(true);
  const targets=await ui.locator('.hm-pack-sections button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().height));expect(targets.every(h=>h>=44)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`dashboard-${width}-${colorScheme}.png`)});
  await ui.getByRole('button',{name:/7 Grammar and translation/}).click();
  await expect(ui.getByRole('region',{name:'Practice selection'})).toBeFocused();
  await expect(ui.getByRole('button',{name:'Practice selected (1)',exact:true})).toBeInViewport();
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
  await expect(ui.getByRole('progressbar',{name:'Session progress'})).toHaveAttribute('value','0');
  await expect(ui.getByRole('button',{name:'Submit and reveal',exact:true})).toBeDisabled();
  await ui.getByRole('button',{name:'Coordinate',exact:true}).click();await expect(ui.getByRole('button',{name:'Coordinate',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await fits()).toBe(true);await page.screenshot({path:test.info().outputPath(`word-order-${width}-${colorScheme}.png`)});
  await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();
  await expect(ui.locator('.hm-pack-reveal')).toBeFocused();await expect(ui.getByRole('heading',{name:'Answer matches'})).toBeInViewport();
  const next=ui.getByRole('button',{name:'Save result and next',exact:true});await next.scrollIntoViewIfNeeded();await expect(next).toBeInViewport();
  await page.screenshot({path:test.info().outputPath(`comparison-${width}-${colorScheme}.png`)});
  await next.click();await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible();expect(host.errors).toEqual([]);
});

test('explicit paused-list preference persists through reload with no grades or card recreation',async({page})=>{
  const host=await openSdkWidget(page,'study_packs',{coursePack:{...pack,scheduledCardsPaused:true},popupLayout:true}),ui=host.frame;
  await expect(ui.getByText('Scheduled cards paused',{exact:true})).toBeVisible();
  expect(host.calls.filter(c=>c.methodName==='rem.setEnablePractice')).toHaveLength(pack.items.length);
  const child=page.frames().find(f=>f.url().startsWith('https://hanzi-plugin.test/'))!;await child.evaluate(()=>location.reload());
  await expect(ui.getByRole('heading',{name:'Midterm review'})).toBeVisible();
  expect(host.calls.filter(c=>c.methodName==='rem.setEnablePractice')).toHaveLength(pack.items.length);
  expect(host.calls.some(c=>/createRem|updateCardRepetitionStatus|setPracticeDirection|delete/.test(c.methodName))).toBe(false);expect(host.errors).toEqual([]);
});

test('section tiles take you directly to that section’s saved session and retain its draft',async({page})=>{
  await page.setViewportSize({width:320,height:852});
  const host=await openSdkWidget(page,'study_packs',{coursePack:pack,popupLayout:true}),ui=host.frame;
  await ui.getByRole('button',{name:/1 Oral reading/}).click();await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
  await ui.getByLabel('Your answer',{exact:true}).fill('unfinished draft');await ui.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();
  await ui.getByRole('button',{name:/7 Grammar and translation/}).click();await expect(ui.getByRole('region',{name:'Practice selection'})).toBeFocused();
  await ui.getByRole('button',{name:/1 Oral reading/}).click();await expect(ui.getByRole('group',{name:'Saved session'})).toBeFocused();
  await expect(ui.getByRole('button',{name:'Resume (1/1)',exact:true})).toBeInViewport();await ui.getByRole('button',{name:'Resume (1/1)',exact:true}).click();
  await expect(ui.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('unfinished draft');expect(host.errors).toEqual([]);
});

test('explicit reveal without an answer saves a miss and finishes before missed practice',async({page})=>{
  const host=await openSdkWidget(page,'study_packs',{coursePack:coursePack([courseItem({id:'unknown',kind:'text',mode:'facts',glyph:undefined,prompt:'Recall the fact.',answers:['Xu Shen'],selfGrade:true})]),popupLayout:true}),ui=host.frame;
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();await expect(ui.getByRole('button',{name:'Submit and reveal',exact:true})).toBeDisabled();
  await ui.getByRole('button',{name:'Reveal without answering',exact:true}).click();await expect(ui.getByRole('button',{name:'I got it',exact:true})).toHaveCount(0);
  await ui.getByRole('button',{name:'Save result and next',exact:true}).click();await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible();
  const ratings=host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus');expect(ratings).toHaveLength(1);expect(ratings[0].args.score).toBe(0);
  await ui.getByRole('button',{name:'Return to dashboard',exact:true}).click();await expect(ui.getByRole('button',{name:'Practice missed',exact:true})).toBeEnabled();
  await expect(ui.getByRole('button',{name:'Practice unstudied (0)',exact:true})).toBeDisabled();expect(host.errors).toEqual([]);
});
