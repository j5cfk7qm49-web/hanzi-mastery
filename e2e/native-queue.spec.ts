import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openSdkWidget} from './sdk-host';
import {drawCharacter} from './draw-character';
import {REVIEW_HOST_CSS} from '../src/ui/reviewHostCss';

for(const beautiful of [false,true])for(const width of [320,393])for(const skill of ['writing','pinyin','listening'] as const){
  test(`native ${skill} uses the existing mode in ${beautiful?'Beautiful':'Compact'} queue at ${width}px`,async({page,browserName})=>{
    // Windows WebKit's native media loader bypasses Playwright route fulfillment.
    // Supply a real HTTPS recording for its playback check; never fabricate completion.
    test.skip(skill==='listening' && browserName==='webkit' && !process.env.HANZI_NATIVE_QUEUE_AUDIO_URL,'Native WebKit media playback requires a real HTTPS fixture URL.');
    await page.setViewportSize({width,height:852});
    const host=await openSdkWidget(page,skill==='writing'?'hanzi_review':'recall_review',{nativeQueueSkill:skill,nativeQueueAudioUrl:process.env.HANZI_NATIVE_QUEUE_AUDIO_URL});
    // Same captured host wrapper fixture as the layout suite, with the actual SDK bundle inside.
    await page.evaluate(({beautiful})=>{
      const frame=document.querySelector('iframe')!,button=document.querySelector('button')!;
      frame.dataset.pluginId='hanzi_mastery_handwriting_v1';frame.style.width='100%';frame.style.height='400px';
      const queue=document.createElement('div');queue.className=`hm-layout-host rn-queue${beautiful?' hm-layout-beautiful queue-beautiful-box':''}`;
      queue.innerHTML=`<header class="hm-layout-toolbar">Simulated RemNote queue · ${beautiful?'Beautiful':'Compact'}</header><div class="hm-layout-card"><div class="hm-layout-repetition spacedRepetition"><main class="hm-layout-scroll"><div class="rn-queue__content">${beautiful?'<div class="beautiful-queue-insight-scroll-layout"><div class="beautiful-queue-card-scroll-stage"><div class="beautiful-queue-card-content">':''}<div class="hm-layout-native-content box-border"><p>Native question</p><div class="fade-in-first-load relative"><div class="frame-holder" style="display:flex"></div></div></div>${beautiful?'</div></div><div class="beautiful-queue-card-free-space"></div><div class="beautiful-queue-bottom-fade-spacer"></div></div>':''}</div></main>${beautiful?'<div class="beautiful-queue-bottom-controls-overlay"></div>':''}</div></div>${beautiful?'':'<footer class="hm-layout-native"></footer>'}`;
      queue.querySelector('.frame-holder')!.append(frame);
      const footer=beautiful ? document.createElement('footer') : queue.querySelector('footer')!;footer.className='hm-layout-native';footer.append(button);
      if(beautiful)queue.querySelector('.beautiful-queue-bottom-controls-overlay')!.append(footer);
      document.body.replaceChildren(queue);document.body.style.margin='0';
    },{beautiful});
    await page.addStyleTag({content:await readFile('e2e/layout-host.css','utf8')+REVIEW_HOST_CSS});
    if(skill==='writing'){
      await expect(host.frame.getByLabel('Reference character')).toContainText('海');
      await host.frame.getByRole('button',{name:'Begin test',exact:true}).click();
      await drawCharacter(host.frame.getByLabel('Chinese handwriting canvas'),'氵');await expect(host.frame.getByLabel('Result saved')).toBeVisible();
      const writes=host.calls.filter(c=>c.methodName==='storage.setSynced');
      expect(writes.some(c=>String(c.args.key).startsWith('hanzi-mastery-study-pack-v1:fixture-course:writing:'))).toBe(true);
    }else if(skill==='pinyin'){
      await expect(host.frame.getByRole('heading',{name:'木',exact:true})).toBeVisible();
      await page.evaluate(()=>{(window as unknown as {editNativeStudyAnswer(v:string):void}).editNativeStudyAnswer('mǔ Explanation: edited current Rem answer');});
      await expect.poll(()=>host.frame.locator('body').innerText()).toContain('Recall the Pinyin.');
      // Reload the widget to start a new review using the freshly edited native answer.
      await page.locator('iframe').evaluate((frame:HTMLIFrameElement)=>{frame.src=frame.src;});
      await host.frame.getByRole('button',{name:'Begin recall test',exact:true}).click();
      await host.frame.getByLabel('Your pinyin').fill('mu3');await host.frame.getByRole('button',{name:'Check first answer',exact:true}).click();
      await expect(host.frame.getByLabel('Result saved')).toBeVisible();await expect(host.frame.locator('.hm-outcome.hm-pass')).toBeVisible();
      await expect(host.frame.getByText('mǔ',{exact:true})).toBeVisible();
    }else{
      await host.frame.getByRole('button',{name:'Begin recall test',exact:true}).click();
      expect(await host.frame.locator('body').innerText()).not.toContain('eng');
      await host.frame.getByLabel('Your pinyin').fill('eng1');
      await expect(host.frame.getByRole('button',{name:'Check first answer',exact:true})).toBeDisabled();
      await host.frame.getByRole('button',{name:'Play reference audio',exact:true}).click();
      await expect(host.frame.getByRole('button',{name:'Check first answer',exact:true})).toBeEnabled({timeout:20000});
      await host.frame.getByRole('button',{name:'Check first answer',exact:true}).click();
      await expect(host.frame.getByLabel('Result saved')).toBeVisible();await expect(host.frame.locator('.hm-outcome.hm-pass')).toBeVisible();
      expect(host.calls.some(c=>c.methodName==='rem.findOne' && c.args.remId==='native-audio')).toBe(true);
    }
    expect(await host.frame.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(page.getByRole('button',{name:'Show Answer',exact:true})).toBeVisible();
    const frame=(await page.locator('iframe').boundingBox())!,controls=(await page.getByRole('button',{name:'Show Answer',exact:true}).boundingBox())!;
    expect(frame.y+frame.height).toBeLessThanOrEqual(controls.y+1);
    expect(host.calls.some(c=>/updateCardRepetitionStatus|rem.createRem|rem.setText|rem.setBackText|rem.setPracticeDirection|rem.setEnablePractice/.test(c.methodName))).toBe(false);
    expect(host.errors).toEqual([]);
    await page.screenshot({path:test.info().outputPath(`native-${skill}-${beautiful?'beautiful':'compact'}-${width}.png`)});
  });
}
test('a missing authored listening recording never substitutes a device voice',async({page})=>{
  const host=await openSdkWidget(page,'recall_review',{nativeQueueSkill:'listening',nativeQueueAudioAvailable:false});
  await host.frame.getByRole('button',{name:'Begin recall test',exact:true}).click();
  await expect(host.frame.getByRole('button',{name:'Play reference audio',exact:true})).toBeDisabled();
  await expect(host.frame.getByText('A recording is required',{exact:false})).toBeVisible();
  await expect(host.frame.getByLabel('Reference voice')).toHaveCount(0);expect(host.errors).toEqual([]);
});
