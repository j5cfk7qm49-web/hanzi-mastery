import {test,expect} from '@playwright/test';
import {openSdkWidget} from './sdk-host';
import {coursePack,courseItem} from '../tests/helpers/course-pack';
import {drawCharacter} from './draw-character';

const items=[
  courseItem({id:'reading',section:1,mode:'reading',kind:'oral',glyph:'大學之道',syllables:['dà','xué','zhī','dào'],answers:['dà xué zhī dào'],audioId:'reference'}),
  courseItem({id:'listening',section:2,mode:'dictation',kind:'text',glyph:undefined,input:'pinyin',answers:['a'],audioId:'reference'}),
  courseItem({id:'meaning',section:3,mode:'radical-meaning',kind:'text',glyph:'木',answers:['wood']}),
  courseItem({id:'pinyin',section:3,mode:'radical-identity',kind:'text',glyph:'木',input:'pinyin',answers:['mù'],selfGrade:false}),
  courseItem({id:'radical',section:3,mode:'radical-writing',kind:'writing',glyph:'氵',referenceGlyph:'海',answers:['氵']}),
  courseItem({id:'writing',section:4,mode:'writing',kind:'writing',glyph:'一',answers:['一']}),
  courseItem({id:'lookup',section:4,mode:'dictionary-lookup',kind:'text',glyph:'心',answers:['Found the entry']}),
  courseItem({id:'formation',section:5,mode:'formation',kind:'choice',glyph:'山',choices:['Pictograph','Borrowing'],answers:['Pictograph']}),
  courseItem({id:'fact',section:6,mode:'facts',kind:'text',glyph:undefined,answers:['Xu Shen']}),
  courseItem({id:'order',section:7,mode:'word-order',kind:'choice',glyph:'修行',choices:['Coordinate','Verb–object'],answers:['Coordinate']}),
  courseItem({id:'translation',section:7,mode:'translation',kind:'text',glyph:'學',answers:['learning']}),
].map(item=>({...item,prompt:`Fixture ${item.mode}`,reveal:'Authored comparison for this exercise.'}));
const pack={...coursePack(items),sections:Array.from({length:7},(_,i)=>({id:i+1,title:`Section ${i+1}`})),audio:[{id:'reference',path:'private_assets/audio/fixture.wav',bytes:16044,sha256:'a'.repeat(64),url:'https://hanzi-plugin.test/fixture.wav'}]};

for(const viewport of [{width:786,height:593},{width:393,height:852}])test(`all seven course sections scroll and update linked schedules at ${viewport.width}px`,async({page,browserName})=>{
  await page.setViewportSize(viewport);
  const host=await openSdkWidget(page,'study_packs',{coursePack:pack,popupLayout:true,pausedStudyCards:true}),ui=host.frame;
  const surface=ui.getByRole('region',{name:'Hanzi Mastery study window'});
  await expect(ui.getByRole('heading',{name:'Fixture course'})).toBeVisible();
  await expect(ui.getByRole('alert')).toHaveCount(0);
  let skipped=0;
  for(const item of items){
    await ui.getByRole('combobox',{name:'Section',exact:true}).selectOption(String(item.section));await ui.getByRole('combobox',{name:'Activity',exact:true}).selectOption(item.mode);
    await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
    if(item.kind==='oral' || item.mode==='dictation'){
      if(item.kind==='oral'){
        await expect(ui.getByLabel('Private course reference')).toHaveCount(0);await expect(ui.getByRole('button',{name:'I got it',exact:true})).toHaveCount(0);
        await ui.getByRole('button',{name:"I've read aloud — compare"}).click();await expect(ui.getByRole('button',{name:'I got it',exact:true})).toBeDisabled();
      }
      const audio=ui.getByLabel('Private course reference');await expect(audio).toHaveAttribute('src',/fixture.wav/);
      await ui.getByRole('button',{name:'Play course reference',exact:true}).click();
      if(browserName==='webkit'){
        await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.ended),{timeout:5000}).toBe(true).catch(()=>{});
      }else await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.ended),{timeout:15000}).toBe(true);
      if(!await audio.evaluate((el:HTMLAudioElement)=>el.ended)){
        expect(browserName).toBe('webkit');skipped++;test.info().annotations.push({type:'codec-limitation',description:'Windows WebKit did not complete fixture audio. Verified disabled grading and no-result skip instead; physical iPhone playback is not established.'});
        await expect(ui.getByRole('button',{name:item.kind==='oral'?'I got it':'Submit and reveal',exact:true})).toBeDisabled();await ui.getByRole('button',{name:item.kind==='oral'?'Skip reading (no result)':'Skip audio activity (no result)',exact:true}).click();
      }else{
        if(item.kind!=='oral'){await ui.getByLabel('Your pinyin').fill('a');await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();}
        await ui.getByRole('button',{name:'I got it',exact:true}).click();
      }
    }else if(item.kind==='writing'){
      if(item.referenceGlyph)await expect(ui.getByLabel('Reference character')).toHaveText('海');
      await ui.getByRole('button',{name:'Begin test',exact:true}).click();const canvas=ui.getByLabel('Chinese handwriting canvas');await expect(canvas).toHaveAttribute('aria-busy','false');await drawCharacter(canvas,item.answers[0]);
      await expect(ui.getByText('Course result saved',{exact:true})).toBeVisible();await ui.getByRole('button',{name:'Next activity',exact:true}).click();
    }else if(item.mode==='dictionary-lookup')await ui.getByRole('button',{name:'I found the entry',exact:true}).click();
    else{
      if(item.kind==='choice')await ui.getByRole('button',{name:item.answers[0],exact:true}).click();
      else await ui.getByLabel(item.input==='pinyin'?'Your pinyin':'Your answer',{exact:true}).fill(item.answers[0]);
      await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();
      await ui.getByRole('button',{name:item.kind==='choice' || !item.selfGrade?'Save result and next':'I got it',exact:true}).click();
    }
    await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible().catch(async e=>{console.log(JSON.stringify({item:item.id,text:await ui.locator('body').innerText(),calls:host.calls.slice(-12)}));throw e;});
    const geometry=await surface.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));
    expect(geometry.scrollWidth,JSON.stringify({item:item.id,...geometry})).toBeLessThanOrEqual(geometry.width+1);
    const next=ui.getByRole('button',{name:'Return to dashboard',exact:true});await next.scrollIntoViewIfNeeded();
    const box=(await next.boundingBox())!;expect(box.y+box.height).toBeLessThan(viewport.height);await next.click();
  }
  const ratings=host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus');expect(ratings).toHaveLength(items.length-skipped);expect(ratings.every(c=>c.args.score===1)).toBe(true);
  expect(host.calls.filter(c=>c.methodName==='card.getAll')).toHaveLength(1);
  expect(host.calls.some(c=>/rateCurrentCard|setEnablePractice|setPracticeDirection|delete|remove/.test(c.methodName))).toBe(false);
  await ui.getByText('Study settings and course notes',{exact:true}).click();await ui.getByLabel('Update linked RemNote card schedules (Good / Again)',{exact:true}).uncheck();
  await ui.getByRole('combobox',{name:'Section',exact:true}).selectOption('3');await ui.getByRole('combobox',{name:'Activity',exact:true}).selectOption('radical-meaning');
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();await ui.getByLabel('Your answer',{exact:true}).fill('wood');await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();await ui.getByRole('button',{name:'Needs practice',exact:true}).click();
  await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible();expect(host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus')).toHaveLength(items.length-skipped);
  expect(host.errors).toEqual([]);await page.screenshot({path:test.info().outputPath(`course-${viewport.width}.png`)});
});

test('a saved assessment survives a paused-card lookup failure and resumes with one native rating',async({page})=>{
  const host=await openSdkWidget(page,'study_packs',{coursePack:{...pack,items:[items[2]]},pausedStudyCards:true,emptyCardLookupOnce:true}),ui=host.frame;
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();await ui.getByLabel('Your answer',{exact:true}).fill('wood');await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();await ui.getByRole('button',{name:'I got it',exact:true}).click();
  await expect(ui.getByRole('alert')).toContainText('unique matching forward');await expect(ui.getByRole('button',{name:'Retry session save',exact:true})).toHaveCount(0);
  await expect(ui.getByRole('button',{name:'Retry card update and continue',exact:true})).toBeEnabled();
  expect(host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus')).toHaveLength(0);
  const child=page.frames().find(f=>f.url().startsWith('https://hanzi-plugin.test/'))!;await child.evaluate(()=>location.reload());
  await expect(ui.getByRole('alert')).toHaveCount(0);await ui.getByRole('button',{name:/Resume/}).click();await expect(ui.getByRole('button',{name:'Needs practice',exact:true})).toBeDisabled();
  await ui.getByRole('button',{name:'Finish saved result',exact:true}).click();await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible();
  const ratings=host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus');expect(ratings).toHaveLength(1);expect(ratings[0].args.score).toBe(1);
  const writes=host.calls.filter(c=>c.methodName==='storage.setSynced' && String(c.args.key).endsWith(':item:meaning'));expect(writes).toHaveLength(1);expect((writes[0].args.value as any).attempts).toBe(1);
  expect(host.calls.some(c=>/setEnablePractice|setPracticeDirection|rateCurrentCard|delete|remove/.test(c.methodName))).toBe(false);expect(host.errors).toEqual([]);
});

test('mouse wheel reaches reading advance controls in a short desktop popup',async({page,browserName})=>{
  test.skip(browserName==='webkit','This project emulates a touch-only iPhone; mouse wheel is checked in desktop Chromium and the live Windows app.');
  await page.setViewportSize({width:786,height:593});const host=await openSdkWidget(page,'study_packs',{coursePack:{...pack,items:[items[0]]},popupLayout:true}),ui=host.frame;
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();const surface=ui.getByRole('region',{name:'Hanzi Mastery study window'}),box=(await surface.boundingBox())!;
  await page.mouse.move(box.x+box.width-30,box.y+box.height-45);await page.mouse.wheel(0,1800);
  await expect.poll(()=>surface.evaluate(el=>el.scrollTop)).toBeGreaterThan(50);
  const advance=ui.getByRole('button',{name:"I've read aloud — compare"});await expect(advance).toBeInViewport();await expect(ui.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
  await page.screenshot({path:test.info().outputPath('desktop-reading-scroll.png')});
});
