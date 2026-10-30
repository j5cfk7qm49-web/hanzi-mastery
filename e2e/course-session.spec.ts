import {test,expect} from '@playwright/test';
import {courseItem,coursePack} from '../tests/helpers/course-pack';
import {openSdkWidget} from './sdk-host';

test('formation choices make one pass even when every answer is missed',async({page})=>{
  const glyphs=['老','考','孝','山'];
  const pack=coursePack(glyphs.map((glyph,i)=>courseItem({id:`formation-${i}`,section:5,kind:'choice',mode:'formation',glyph,prompt:'Choose the formation type.',choices:['Form and sound','Combined meanings','Pictograph','Evolving and deriving'],answers:[glyph==='孝'?'Combined meanings':glyph==='山'?'Pictograph':'Evolving and deriving'],selfGrade:false})));
  pack.sections=[{id:5,title:'Six composition principles'}];
  const host=await openSdkWidget(page,'study_packs',{coursePack:pack,pausedStudyCards:true,popupLayout:true}),ui=host.frame;
  await ui.getByRole('button',{name:'Practice selected (4)',exact:true}).click();const seen:string[]=[];
  for(let index=0;index<4;index++){
    await expect(ui.getByRole('button',{name:'Form and sound',exact:true})).toBeEnabled();seen.push((await ui.locator('.hm-pack-glyph').innerText()).trim());
    await ui.getByRole('button',{name:'Form and sound',exact:true}).click();await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();await ui.getByRole('button',{name:'Save result and next',exact:true}).click();
    await expect(ui.getByText(index===3?'Session complete':`Mixed practice · ${index+2} / 4`,{exact:true})).toBeVisible();
  }
  expect([...seen].sort()).toEqual([...glyphs].sort());expect(new Set(seen).size).toBe(4);
  const ratings=host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus');expect(ratings).toHaveLength(4);expect(new Set(ratings.map(c=>c.args.id)).size).toBe(4);
  await ui.getByRole('button',{name:'Return to dashboard',exact:true}).click();await expect(ui.getByRole('button',{name:'Practice unstudied (0)',exact:true})).toBeDisabled();
  await ui.getByRole('button',{name:'Practice missed',exact:true}).click();await expect(ui.getByText('Missed items · 1 / 4',{exact:true})).toBeVisible();expect(host.errors).toEqual([]);
});

test('section resume slots and All sections survive switching and reload',async({page})=>{
  await page.goto('/?course');
  const pack=coursePack(['a','b','c','d'].map((id,index)=>courseItem({id,section:index<2?3:7,kind:'text',mode:'recall',prompt:`Recall ${id}`,answers:[id],selfGrade:false})));
  pack.sections=[{id:3,title:'Radicals'},{id:7,title:'Grammar'}];
  await page.evaluate(pack=>{
    const prefix='hanzi-mastery-study-pack-v1:';localStorage.setItem(prefix+'active',JSON.stringify(pack.studyPackId));localStorage.setItem(prefix+pack.studyPackId+':pack',JSON.stringify(pack));
    localStorage.setItem(prefix+pack.studyPackId+':session',JSON.stringify({id:'old-session',sourceVersion:pack.sourceVersion,ids:['a','b'],index:0,label:'Mixed practice',draft:{itemId:'a',answer:'old draft',submitted:false}}));
  },pack);await page.reload();
  await expect(page.getByRole('group',{name:'Saved session'})).toContainText('Radicals');
  await expect(page.getByRole('button',{name:'Resume (1/2)',exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Section',exact:true}).selectOption('7');await expect(page.getByRole('button',{name:/Resume/})).toHaveCount(0);
  await page.getByRole('button',{name:'Practice selected (2)',exact:true}).click();await page.getByRole('textbox',{name:'Your answer',exact:true}).fill('wrong');await page.getByRole('button',{name:'Submit and reveal',exact:true}).click();await page.getByRole('button',{name:'Save result and next',exact:true}).click();
  await expect(page.getByText('Mixed practice · 2 / 2',{exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Your answer',exact:true}).fill('grammar draft');await page.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();
  await page.getByRole('combobox',{name:'Section',exact:true}).selectOption('3');await page.getByRole('button',{name:'Resume (1/2)',exact:true}).click();await expect(page.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('old draft');
  await page.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();await page.getByRole('button',{name:'Practice entire list',exact:true}).click();await page.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();await page.reload();
  await expect(page.getByRole('button',{name:'Resume (1/4)',exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Section',exact:true}).selectOption('7');await expect(page.getByRole('group',{name:'Saved session'})).toContainText('Grammar');await page.getByRole('button',{name:'Resume (2/2)',exact:true}).click();await expect(page.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('grammar draft');
  await page.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();await page.getByRole('combobox',{name:'Section',exact:true}).selectOption('3');await page.getByRole('button',{name:'Resume (1/2)',exact:true}).click();await expect(page.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('old draft');
});

for(const width of [786,393])test(`course list finishes once; missed and unstudied are separate at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:852});await page.goto('/?course');
  const pack=coursePack([
    ...['a','b','c'].map(id=>courseItem({id,kind:'text',mode:'recall',prompt:`Recall ${id}`,answers:[id],selfGrade:false})),
    courseItem({id:'unavailable',kind:'oral',mode:'sound-recognition',prompt:'Read without a reference.',audioId:undefined})
  ]);
  await page.evaluate(pack=>{const prefix='hanzi-mastery-study-pack-v1:';localStorage.setItem(prefix+'active',JSON.stringify(pack.studyPackId));localStorage.setItem(prefix+pack.studyPackId+':pack',JSON.stringify(pack));},pack);await page.reload();
  await page.getByRole('button',{name:'Practice selected (4)',exact:true}).click();
  const session=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-mastery-study-pack-v1:test-pack:session')!));
  const original=await session();let missed='';
  for(const [index,id] of (original.ids as string[]).entries()){
    if(id==='unavailable'){
      await page.getByRole('button',{name:'Skip reading (no result)',exact:true}).click();
    }else{
      await expect(page.getByRole('heading',{name:`Recall ${id}`,exact:true})).toBeVisible();
      await page.getByRole('textbox',{name:'Your answer',exact:true}).fill(missed?id:'wrong');
      await page.getByRole('button',{name:'Submit and reveal',exact:true}).click();await page.getByRole('button',{name:'Save result and next',exact:true}).click();
      if(!missed){
        missed=id;
        await expect.poll(async()=>(await session()).index).toBe(index+1);
        if(index<original.ids.length-1){
          await page.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();await page.reload();
          await page.getByRole('button',{name:`Resume (${index+2}/4)`,exact:true}).click();
        }
      }
    }
    await expect.poll(async()=>(await session()).index).toBe(index+1);
    expect((await session()).ids).toEqual(original.ids);
  }
  await expect(page.getByRole('heading',{name:'Session complete',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Return to dashboard',exact:true}).click();
  await expect(page.getByRole('button',{name:/Resume/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Practice unstudied (1)',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${test.info().project.name}-course-session-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Practice missed',exact:true}).click();await expect(page.getByRole('heading',{name:`Recall ${missed}`,exact:true})).toBeVisible();
  expect((await session()).ids).toEqual([missed]);
  await page.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();
  await page.getByRole('button',{name:'Practice unstudied (1)',exact:true}).click();expect((await session()).ids).toEqual(['unavailable']);
  await page.getByRole('button',{name:'Skip reading (no result)',exact:true}).click();await expect(page.getByRole('heading',{name:'Session complete',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Practice unstudied (1)',exact:true})).toBeEnabled();
  const progress=await page.evaluate(()=>['a','b','c','unavailable'].map(id=>JSON.parse(localStorage.getItem('hanzi-mastery-study-pack-v1:test-pack:item:'+id)||'null')));
  expect(progress.slice(0,3).map(p=>p.attempts)).toEqual([1,1,1]);expect(progress[3]).toBeNull();
});
