import { test,expect,type Page } from '@playwright/test';
import { zipSync,strToU8 } from 'fflate';
import { existsSync,readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { syntheticHandoff } from '../tests/helpers/course-pack';
import { openSdkWidget } from './sdk-host';
import { drawCharacter } from './draw-character';
import {coursePack,courseItem} from '../tests/helpers/course-pack';

const raw=syntheticHandoff();
const syntheticZip=Buffer.from(zipSync(Object.fromEntries(Object.entries(raw).map(([name,data])=>['handoff/data/'+name,strToU8(JSON.stringify(data))]))));
async function importFixture(page:Page) {
  await page.goto('/?course');
  await page.getByLabel('Handoff ZIP').setInputFiles({name:'course.zip',mimeType:'application/zip',buffer:syntheticZip});
  await expect(page.getByRole('heading',{name:'Classical Chinese I · Midterm (Oct 30, 2026)'})).toBeVisible({timeout:30000});
}
test('generic touch circles survive reload; exercise layout fits a phone',async({page})=>{
  // Circling remains an independently reusable mode; the current midterm uses radical writing.
  await page.goto('/?course');
  const fixture=coursePack();await page.evaluate(pack=>{const prefix='hanzi-mastery-study-pack-v1:';localStorage.setItem(prefix+'active',JSON.stringify(pack.studyPackId));localStorage.setItem(prefix+pack.studyPackId+':pack',JSON.stringify(pack));},fixture);await page.reload();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('combobox',{name:'Section',exact:true}).selectOption('3');await page.getByRole('combobox',{name:'Activity',exact:true}).selectOption('circle');
  await page.getByRole('button',{name:/Practice selected/}).click();const circle=page.getByRole('img',{name:/Circle the radical/});
  await expect(circle).toBeVisible();expect(await circle.locator('polyline').count()).toBe(0);
  await circle.evaluate(svg=>{
    const rect=svg.getBoundingClientRect();
    for(const [type,x,y] of [['pointerdown',.15,.2],['pointermove',.35,.3],['pointermove',.2,.5],['pointerup',.15,.2]] as const)svg.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',clientX:rect.left+rect.width*x,clientY:rect.top+rect.height*y}));
  });
  await expect(circle.locator('polyline')).toHaveCount(1);
  await page.getByLabel('Location description').fill('left side');await page.getByRole('button',{name:'Reveal and compare'}).click();
  await expect(page.getByText(/no verified stroke mask/)).toBeVisible();
  await page.reload();await page.getByRole('button',{name:/Resume/}).click();await expect(page.getByLabel('Location description')).toHaveValue('left side');
  await expect(page.getByRole('img').locator('polyline')).toHaveCount(1);
  await page.getByRole('button',{name:'Needs practice'}).click();await page.getByRole('button',{name:'Save and return to dashboard'}).click();
  await page.getByRole('button',{name:'Practice missed',exact:true}).click();await expect(page.getByRole('img')).toBeVisible();
  const fit=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);expect(fit).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:`test-results/${test.info().project.name}-course-circle.png`,fullPage:true});
});

test('radical handwriting keeps the source visible, grades only its hidden radical, and persists the result',async({page})=>{
  await page.goto('/?course');
  const fixture=coursePack([courseItem({kind:'writing',mode:'radical-writing',referenceGlyph:'海',glyph:'氵',answers:['氵'],prompt:'Write the radical by itself.',selfGrade:false})]);
  await page.evaluate(pack=>{const prefix='hanzi-mastery-study-pack-v1:';localStorage.setItem(prefix+'active',JSON.stringify(pack.studyPackId));localStorage.setItem(prefix+pack.studyPackId+':pack',JSON.stringify(pack));},fixture);await page.reload();
  await page.getByRole('button',{name:/Practice selected/}).click();
  await expect(page.getByLabel('Reference character')).toHaveText('海');
  expect(await page.locator('body').innerText()).not.toContain('氵');
  await page.getByRole('button',{name:'Begin test',exact:true}).click();
  const canvas=page.getByLabel('Chinese handwriting canvas');await expect(canvas).toHaveAttribute('aria-busy','false');await drawCharacter(canvas,'氵');
  await expect(page.getByText('Course result saved',{exact:true})).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-mastery-study-pack-v1:test-pack:item:circle-sea')!));expect(before.attempts).toBe(1);expect(before.lastPassed).toBe(true);
  await page.getByRole('button',{name:'Save and return to dashboard'}).click();await page.reload();await expect(page.locator('.hm-pack-stats')).toContainText('1 / 1');await expect(page.getByRole('button',{name:'Practice unstudied (0)',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('course writing uses actual Hanzi Writer and saves under the course namespace',async({page})=>{
  await importFixture(page);await page.getByRole('combobox',{name:'Section',exact:true}).selectOption('4');await page.getByRole('combobox',{name:'Activity',exact:true}).selectOption('writing');
  await page.getByRole('button',{name:/Practice selected/}).click();await page.getByRole('button',{name:'Begin test',exact:true}).click();
  const target=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hanzi-mastery-study-pack-v1:classical-chinese-i-2026-midterm:session')!);const p=JSON.parse(localStorage.getItem('hanzi-mastery-study-pack-v1:classical-chinese-i-2026-midterm:pack')!);return p.items.find((i:{id:string})=>i.id===s.ids[0]).glyph;});
  const canvas=page.getByLabel('Chinese handwriting canvas');await expect(canvas).toHaveAttribute('aria-busy','false');await drawCharacter(canvas,target);
  await expect(page.getByText('Passed this writing test')).toBeVisible();await expect(page.getByLabel('Result saved')).toBeVisible();
  await expect(page.getByText('Course result saved',{exact:true})).toBeVisible();await expect(page.getByText('Saved · Rate in RemNote',{exact:true})).toHaveCount(0);
  const keys=await page.evaluate(()=>Object.keys(localStorage));expect(keys.some(k=>k.startsWith('hm:v2:writing:'))).toBe(false);expect(keys.some(k=>k.includes(':writing:hm:v2:writing:'))).toBe(true);
});
test('workbench course page excludes focused-word readings and editor controls',async({page})=>{
  const host=await openSdkWidget(page,'workbench');await expect(host.frame.locator('.hm-word-heading')).toContainText('xíng');
  await host.frame.getByRole('button',{name:'Midterm / course study',exact:true}).click();await expect(host.frame.getByRole('heading',{name:'Midterm review'})).toBeVisible();
  await expect(host.frame.locator('.hm-word-heading')).toHaveCount(0);await expect(host.frame.locator('.hm-add-more')).toHaveCount(0);
  expect(await host.frame.locator('body').innerText()).not.toContain('xíng');expect(host.errors).toEqual([]);
});
test('compiled course SDK import creates native cards and rates only the linked card',async({page})=>{
  const host=await openSdkWidget(page,'study_packs');
  await host.frame.getByLabel('Handoff ZIP').setInputFiles({name:'course.zip',mimeType:'application/zip',buffer:syntheticZip});
  await expect(host.frame.getByRole('heading',{name:'Classical Chinese I · Midterm (Oct 30, 2026)'})).toBeVisible({timeout:60000}).catch(async e=>{console.log('Native import state',JSON.stringify({errors:host.errors,calls:host.calls.slice(-8),text:await host.frame.locator('body').innerText()}));throw e;});
  await host.frame.getByRole('combobox',{name:'Section',exact:true}).selectOption('6');await host.frame.getByRole('button',{name:/Practice selected/}).click();
  await host.frame.getByLabel('Your answer',{exact:true}).fill('equivalent answer');await host.frame.getByRole('button',{name:'Submit and reveal'}).click();
  await host.frame.getByRole('button',{name:'I got it'}).click();
  await expect(host.frame.getByText('RemNote card schedule updated and read back.',{exact:true})).toBeVisible();
  expect(host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus')).toHaveLength(1);
  expect(host.calls.filter(c=>/^queue\.|delete|setEnablePractice/.test(c.methodName))).toEqual([]);
  expect(host.calls.some(c=>c.methodName==='rem.createRem')).toBe(true);
  expect(host.calls.some(c=>c.methodName==='storage.setSynced' && String(c.args.key).endsWith(':pack'))).toBe(false);
  expect(host.errors).toEqual([]);
});

const privateRoot=process.env.HM_PRIVATE_HANDOFF || resolve('audit/midterm-handoff/Hanzi_Mastery_Midterm_Codex_Handoff');
test('private complete handoff installs all audio and keeps dictation answers hidden',async({page})=>{
  test.skip(!existsSync(resolve(privateRoot,'data/audio_manifest.json')),'Requires the private handoff; never stored in the public repo.');
  // Build a local archive with all metadata/recordings, excluding classroom PDFs.
  const files:Record<string,Uint8Array>={};for(const name of readdirSync(resolve(privateRoot,'data')))if(name.endsWith('.json'))files['handoff/data/'+name]=new Uint8Array(readFileSync(resolve(privateRoot,'data',name)));
  const manifest=JSON.parse(readFileSync(resolve(privateRoot,'data/audio_manifest.json'),'utf8'));
  for(const asset of manifest.files)files['handoff/'+asset.relative_path]=new Uint8Array(readFileSync(resolve(privateRoot,asset.relative_path)));
  await page.goto('/?course');await page.getByLabel('Handoff ZIP').setInputFiles({name:'private-course.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(files))});
  await expect(page.getByText(/64 audio files stored on this device/)).toBeVisible({timeout:30000});
  await page.evaluate(()=>{const prefix='hanzi-mastery-study-pack-v1:classical-chinese-i-2026-midterm:';const p=JSON.parse(localStorage.getItem(prefix+'pack')!);localStorage.setItem(prefix+'session',JSON.stringify({id:'private-audio-test',sourceVersion:p.sourceVersion,ids:['dictation-a'],index:0,label:'Private dictation test'}));});
  await page.reload();await page.getByRole('button',{name:/Resume/}).click();
  const forbidden=await page.evaluate(()=>{const prefix='hanzi-mastery-study-pack-v1:classical-chinese-i-2026-midterm:';const p=JSON.parse(localStorage.getItem(prefix+'pack')!);const s=JSON.parse(localStorage.getItem(prefix+'session')!);const i=p.items.find((q:{id:string})=>q.id===s.ids[s.index]);return i.answers;});
  const body=await page.locator('body').innerText();expect(body).not.toMatch(/\.mp3|\.m4a/);
  // A vowel such as "a" can also be an ordinary English article in instructions.
  // Check answer-bearing content rather than treating every prose token as a leak.
  await expect(page.locator('.hm-pack-glyph,.hm-pack-reveal')).toHaveCount(0);
  for(const answer of forbidden)await expect(page.getByText(answer,{exact:true})).toHaveCount(0);
  // Blob URLs, not original filenames; user-triggered native controls unlock playback on phones.
  const player=page.getByLabel('Private course reference');
  await expect(player).toHaveAttribute('src',/^blob:/);await expect(player).toHaveAttribute('controls','');
  await player.evaluate((a:HTMLAudioElement)=>{a.playbackRate=4;});await page.getByRole('button',{name:'Play course reference'}).click();
  await expect.poll(async()=>await player.evaluate((a:HTMLAudioElement)=>a.ended) || await page.getByText(/Playback was blocked|This recording cannot play/).count()>0,{timeout:15000}).toBe(true);
  const media=await player.evaluate((a:HTMLAudioElement)=>({ended:a.ended,error:a.error?.code,readyState:a.readyState}));
  if(!media.ended) {
    expect(test.info().project.name).toBe('webkit-phone');
    test.info().annotations.push({type:'codec-limitation',description:`Windows WebKit rejected the private MP3 sample: ${JSON.stringify(media)}. Dictation correctly remained disabled.`});
    console.log('Private MP3 unavailable in Windows WebKit:',JSON.stringify(media));
    await expect(page.getByRole('button',{name:'Submit and reveal'})).toBeDisabled();
    await page.getByRole('button',{name:'Skip audio activity (no result)'}).click();await expect(page.getByText('Session complete')).toBeVisible();
    // Seed a fresh playback fixture in both resume slots; a stale legacy-only
    // rewind must no longer override the later section position.
    await page.evaluate(()=>{const prefix='hanzi-mastery-study-pack-v1:classical-chinese-i-2026-midterm:';const s=JSON.parse(localStorage.getItem(prefix+'session')!);s.id='private-audio-replay';s.index=0;localStorage.setItem(prefix+'session',JSON.stringify(s));localStorage.setItem(prefix+'session:section:2',JSON.stringify(s));});
  } else {
    await expect(page.getByRole('button',{name:'Submit and reveal'})).toBeDisabled();
    await page.getByLabel('Your pinyin').fill('a');await expect(page.getByRole('button',{name:'Submit and reveal'})).toBeEnabled();await page.getByRole('button',{name:'Submit and reveal'}).click();await expect(page.getByText('a',{exact:true})).toBeVisible();
  }
  await page.reload();await page.getByRole('button',{name:/Resume/}).click();
  await expect(page.getByRole('heading',{name:'Listen, then type the vowel or final you heard.'})).toBeVisible();
});
