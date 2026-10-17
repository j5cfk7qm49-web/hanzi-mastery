import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const chars=Array.from('學國書語聽體愛');
async function draw(page:Page,ch:string){
  const data=JSON.parse(await readFile(`node_modules/hanzi-writer-data/${ch}.json`,'utf8')) as {medians:number[][][]};
  const canvas=page.getByRole('application',{name:'Chinese handwriting canvas'});
  await expect(canvas).toHaveAttribute('aria-busy','false');
  const box=await canvas.locator('svg').boundingBox(); if(!box)throw new Error('Missing SVG');
  const scale=(box.width-32)/1024, xOffset=(box.width-1024*scale)/2, yOffset=(box.height-1024*scale)/2;
  for(const median of data.medians){
    // Character space: y=900 is the top of the nominal em square.
    const points=median.map(([x,y])=>({x:box.x+xOffset+x*scale,y:box.y+yOffset+(900-y)*scale}));
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
    for(const p of points.slice(1))await page.mouse.move(p.x,p.y,{steps:3});
    await page.mouse.up();
    await page.waitForTimeout(70);
  }
}
test('real Hanzi Writer accepts seven Traditional median paths and resets between cards',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('/');
  for(const [i,ch] of chars.entries()){
    await page.getByLabel('Demo card').selectOption(String(i));
    await page.getByRole('button',{name:'Begin test'}).click();
    const exercise=page.getByRole('region',{name:'Hanzi Mastery handwriting review'});
    await expect(exercise).not.toContainText(ch);
    await draw(page,ch);
    await expect(page.getByText('Passed this writing test')).toBeVisible();
    await expect(page.getByText('Writing mastery saved and read back.')).toBeVisible();
  }
  expect(errors).toEqual([]);expect(requests.every(u=>u.startsWith('http://127.0.0.1:8081'))).toBe(true);
  await page.screenshot({path:`test-results/${test.info().project.name}-completed.png`,fullPage:true});
  await page.reload();
  await expect(page.getByRole('button',{name:'Begin test'})).toBeVisible();
  const records=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hm:v2:writing:')).map(k=>JSON.parse(localStorage.getItem(k)!)));
  expect(records).toHaveLength(7);expect(records.every(r=>r.attempts===1 && r.stagePasses===1 && r.history[0].attempt.events.length>0)).toBe(true);
});
test('touch trajectory reaches the engine; OS cancellation preserves completed strokes',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Begin test'}).click();
  const canvas=page.getByRole('application');await expect(canvas).toHaveAttribute('aria-busy','false');
  const data=JSON.parse(await readFile('node_modules/hanzi-writer-data/學.json','utf8'));
  await canvas.evaluate((element,median:number[][])=>{
    const svg=element.querySelector('svg')!,box=svg.getBoundingClientRect(),scale=(box.width-32)/1024;
    const touch=(p:number[])=>({identifier:1,target:svg,clientX:box.left+16+p[0]*scale,clientY:box.top+16+(900-p[1])*scale});
    const emit=(type:string,p:number[])=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[touch(p)]},changedTouches:{value:[touch(p)]}});
      svg.dispatchEvent(event);
    };
    emit('touchstart',median[0]);for(const p of median.slice(1))emit('touchmove',p);emit('touchend',median.at(-1)!);
  },data.medians[0]);
  await expect(page.getByText(/1 \/ 16 strokes · 0 rejected attempts/)).toBeVisible();
  await canvas.dispatchEvent('touchcancel');
  await expect(page.getByText(/device interrupted this contact/)).toBeVisible();
  await expect(page.getByText(/1 \/ 16 strokes · 0 rejected attempts/)).toBeVisible();
});
test('reveal causes failure and guided practice preserves it; layout fits a phone',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Begin test'}).click();
  await page.getByRole('application').waitFor();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Simulate native answer reveal'}).click();
  await expect(page.getByText('Writing test failed')).toBeVisible();
  await page.getByRole('button',{name:'Practice with hints and animation'}).click();
  await expect(page.getByRole('button',{name:'Animate strokes'})).toBeVisible();
  await expect(page.getByText('Writing test failed')).toBeVisible();
});
