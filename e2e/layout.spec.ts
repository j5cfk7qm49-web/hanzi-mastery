import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const sizes = [
  {name:'compact-phone',width:320,height:568},
  {name:'iphone-se',width:375,height:667},
  {name:'large-phone-dark',width:430,height:932,dark:true},
  {name:'landscape',width:844,height:390},
  {name:'ipad',width:768,height:1024},
  {name:'narrow-split-view',width:1024,height:768,frameWidth:320},
];
for (const size of sizes) test(`embedded layout: ${size.name}`,async({page})=>{
  await page.setViewportSize({width:size.width,height:size.height});
  await page.emulateMedia({colorScheme:size.dark?'dark':'light'});
  await page.goto(`/?host=mobile&long=1${size.frameWidth?`&width=${size.frameWidth}`:''}`);
  const review=page.frameLocator('iframe');
  await review.getByRole('button',{name:'Begin test'}).click();
  const canvas=review.getByRole('application');await expect(canvas).toHaveAttribute('aria-busy','false');
  await expect.poll(()=>review.locator('html').evaluate(el=>el.scrollHeight<=innerHeight+1)).toBe(true);
  await expect.poll(async()=>{
    const stage=await review.locator('.hm-writing-stage').boundingBox();
    const pane=await page.getByRole('main').boundingBox();if(!stage||!pane)return false;
    // Small landscape windows deliberately scroll instead of shrinking the writing surface.
    if(stage.height>pane.height)return true;
    return stage.y>=pane.y-1 && stage.y+stage.height<=pane.y+pane.height+1;
  }).toBe(true);
  const box=await canvas.boundingBox(),shell=await review.locator('.hm-canvas-shell').boundingBox();
  expect(box).not.toBeNull();expect(shell).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(240);
  expect(Math.abs(box!.width-box!.height)).toBeLessThan(1);
  expect(box!.x-shell!.x).toBeGreaterThanOrEqual(16);
  expect(shell!.x+shell!.width-box!.x-box!.width).toBeGreaterThanOrEqual(16);
  expect(await review.locator('html').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await review.getByRole('button').all())if(await button.isVisible()){
    const rect=await button.boundingBox();expect(rect!.height).toBeGreaterThanOrEqual(44);expect(rect!.width).toBeGreaterThanOrEqual(44);
  }
  const forgot=review.getByRole('button',{name:'I forgot a stroke — end test'});
  await forgot.scrollIntoViewIfNeeded();
  const control=await forgot.boundingBox(),native=await page.getByRole('contentinfo').boundingBox();
  expect(control!.y+control!.height).toBeLessThanOrEqual(native!.y+1);
  expect(native!.y+native!.height).toBeLessThanOrEqual(size.height+1);
  await page.screenshot({path:`test-results/${test.info().project.name}-${size.name}.png`});
});

test('embedded layout: rotation retains strokes and native controls stay separate from results',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/?host=mobile');
  const review=page.frameLocator('iframe');await review.getByRole('button',{name:'Begin test'}).click();
  const canvas=review.getByRole('application');await expect(canvas).toHaveAttribute('aria-busy','false');
  const data=JSON.parse(await readFile('node_modules/hanzi-writer-data/學.json','utf8'));
  const drawTouch=async(median:number[][])=>canvas.evaluate((element,median:number[][])=>{
    const svg=element.querySelector('svg')!,box=svg.getBoundingClientRect(),scale=(box.width-32)/1024;
    const touch=(p:number[])=>({identifier:1,target:svg,clientX:box.left+16+p[0]*scale,clientY:box.top+16+(900-p[1])*scale});
    const emit=(type:string,p:number[])=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[touch(p)]},changedTouches:{value:[touch(p)]}});svg.dispatchEvent(event);
    };
    emit('touchstart',median[0]);for(const p of median.slice(1))emit('touchmove',p);emit('touchend',median.at(-1)!);
  },median);
  await drawTouch(data.medians[0]);
  await expect(review.getByText('1 / 16 strokes · 0 rejected attempts')).toBeVisible();
  await page.setViewportSize({width:844,height:390});
  await expect.poll(async()=>(await canvas.boundingBox())?.width||0).toBeGreaterThan(300);
  await expect(review.getByText('1 / 16 strokes · 0 rejected attempts')).toBeVisible();
  await drawTouch(data.medians[1]);
  await expect(review.getByText('2 / 16 strokes · 0 rejected attempts')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Native Show Answer (simulated)'}).click();
  await expect(review.getByText('Writing test failed')).toBeVisible();
  const saved=review.getByText('Writing mastery saved and read back.');await saved.scrollIntoViewIfNeeded();
  const box=await saved.boundingBox(),native=await page.getByRole('contentinfo').boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(native!.y+1);
  for(const label of ['Forgot','Hard','Good','Easy'])await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
  await review.getByRole('button',{name:'Practice with hints and animation'}).click();
  await expect(review.getByText('Original writing test:',{exact:false})).toBeVisible();
  await expect(review.getByRole('button',{name:'Animate strokes'})).toBeVisible();
});

test('embedded layout: enlarged text reflows inside the widget width',async({page})=>{
  await page.setViewportSize({width:375,height:667});await page.goto('/?host=mobile&long=1');
  const review=page.frameLocator('iframe');await review.getByRole('button',{name:'Begin test'}).click();
  await review.locator('.hm').evaluate(el=>{(el as HTMLElement).style.fontSize='24px';});
  const forgot=review.getByRole('button',{name:'I forgot a stroke — end test'});await forgot.scrollIntoViewIfNeeded();
  expect(await review.locator('html').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await forgot.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('embedded layout: failure brings its heading and save confirmation into view',async({page})=>{
  await page.setViewportSize({width:390,height:504});await page.goto('/?host=mobile&long=1');
  const review=page.frameLocator('iframe');await review.getByRole('button',{name:'Begin test'}).click();
  await expect(review.getByRole('application')).toHaveAttribute('aria-busy','false');
  await expect.poll(()=>review.locator('html').evaluate(el=>el.scrollHeight<=innerHeight+1)).toBe(true);
  await review.getByRole('button',{name:'I forgot a stroke — end test'}).click();
  const heading=review.getByRole('heading',{name:'Writing test failed'});
  const saved=review.getByText('Writing mastery saved and read back.');await expect(saved).toBeVisible();
  // DOM visibility alone passes even when the parent queue clips the result heading.
  await expect.poll(async()=>{
    const h=await heading.boundingBox(),s=await saved.boundingBox(),pane=await page.getByRole('main').boundingBox();
    return !!h && !!s && !!pane && h.y>=pane.y-1 && s.y+s.height<=pane.y+pane.height+1;
  }).toBe(true);
});
