import {test,expect} from '@playwright/test';
import {openSdkWidget} from './sdk-host';
import {drawCharacter} from './draw-character';

test.use({launchOptions:async({browserName},use)=>{await use(browserName==='chromium'?{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}:{});}});

for(const queueStyle of ['compact','beautiful'] as const)for(const width of [320,393])for(const skill of ['writing','pinyin'] as const){
  test(`native execution preserves ${skill} in ${queueStyle} queue at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:852});
    const host=await openSdkWidget(page,skill==='writing'?'hanzi_review':'recall_review',{nativeMode:true,secureHost:true,nativeQueueSkill:skill,queueStyle});
    const review=host.nativeRoot;
    if(skill==='writing'){
      await expect(review.getByLabel('Reference character')).toContainText('海');
      await review.getByRole('button',{name:'Begin test',exact:true}).click();
      const canvas=review.getByLabel('Chinese handwriting canvas');
      await expect(canvas).toHaveAttribute('aria-busy','false');
      await expect.poll(()=>canvas.evaluate(el=>{
        const svg=el.querySelector('svg')!;
        return Math.abs(svg.getBoundingClientRect().width-Number(svg.getAttribute('width')))<1;
      })).toBe(true);
      await drawCharacter(canvas,'氵');
    }else{
      await expect(review.getByRole('heading',{name:'木',exact:true})).toBeVisible();
      await review.getByRole('button',{name:'Begin recall test',exact:true}).click();
      await review.getByLabel('Your pinyin').fill('mu4');
      await review.getByRole('button',{name:'Check first answer',exact:true}).click();
    }
    await expect(review.getByLabel('Result saved')).toBeVisible();
    await expect(review.locator('.hm-outcome.hm-pass')).toBeVisible();
    const root=(await review.boundingBox())!,controls=(await page.getByRole('button',{name:'Show Answer',exact:true}).boundingBox())!;
    expect(root.height).toBeGreaterThan(200);expect(root.y+root.height).toBeLessThanOrEqual(controls.y+1);
    expect(await page.locator('body').evaluate(el=>getComputedStyle(el).overflowY)).toBe('auto');
    expect(await page.locator('#host-sentinel').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('monospace');
    expect(await review.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    expect(host.calls.some(c=>/updateCardRepetitionStatus|rem.createRem|rem.setText|rem.setBackText|rem.setPracticeDirection|rem.setEnablePractice/.test(c.methodName))).toBe(false);
    expect(host.errors).toEqual([]);
    await page.screenshot({path:test.info().outputPath(`${skill}-${queueStyle}-${width}.png`)});
  });
}

test('native execution loads the same editable course list and retains ordinary oral practice',async({page})=>{
  const host=await openSdkWidget(page,'study_packs',{nativeMode:true,secureHost:true,nativeStudy:true,nativeOral:true});
  await host.nativeRoot.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
  await expect(host.nativeRoot.getByRole('button',{name:'Record pronunciation',exact:true})).toBeVisible();
  await expect(host.nativeRoot.getByText('Read aloud first.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>Boolean((window as any).nativePluginInstance.isNative))).toBe(true);
  expect(host.calls.some(c=>/updateCardRepetitionStatus|rem.setEnablePractice|rem.setPracticeDirection/.test(c.methodName))).toBe(false);
  expect(host.errors).toEqual([]);
});

test('native index registers the existing commands without enabling or recreating cards',async({page})=>{
  const host=await openSdkWidget(page,'index',{nativeMode:true,secureHost:true});
  await expect.poll(()=>host.calls.filter(c=>c.methodName==='registerCommand').length).toBe(3);
  expect(await page.evaluate(()=>Boolean((window as any).nativePluginInstance.isNative))).toBe(true);
  expect(host.calls.some(c=>/rem.createRem|updateCardRepetitionStatus|rem.setEnablePractice|rem.setPracticeDirection/.test(c.methodName))).toBe(false);
  expect(host.errors).toEqual([]);
});

test('native execution loads the existing workbench without restyling the host document',async({page})=>{
  const host=await openSdkWidget(page,'workbench',{nativeMode:true,secureHost:true});
  await expect(host.nativeRoot.getByRole('heading',{name:'Hanzi Mastery',exact:true})).toBeVisible();
  await expect(host.nativeRoot.getByRole('button',{name:'Midterm / course study',exact:true})).toBeVisible();
  expect(await page.locator('#host-sentinel').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('monospace');
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).overflowY)).not.toBe('hidden');
  expect(host.errors).toEqual([]);
});

test('declining native execution keeps course practice and the recording-file fallback usable',async({page})=>{
  const host=await openSdkWidget(page,'study_packs',{secureHost:true,nativeStudy:true,nativeOral:true,sandboxedFrame:true});
  await host.frame.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
  await host.frame.getByRole('button',{name:'Record pronunciation',exact:true}).click();
  await expect(host.frame.getByRole('alert')).toContainText('choose a recording');
  await host.frame.getByText('Use an audio file',{exact:true}).click();
  await host.frame.getByLabel('Or choose a pronunciation recording').setInputFiles({name:'voice.m4a',mimeType:'audio/mp4',buffer:Buffer.from('File selection fixture; codec playback is tested separately.')});
  await expect(host.frame.getByLabel('Your pronunciation recording')).toBeVisible();
  await expect(host.frame.getByRole('heading',{name:'Compare with the instructor',exact:true})).toBeVisible();
  expect(host.calls.some(c=>/updateCardRepetitionStatus|rem.setEnablePractice|rem.setPracticeDirection/.test(c.methodName))).toBe(false);
  expect(host.errors).toEqual([]);
});

test.describe('native browser microphone',()=>{
  test.skip(({browserName})=>browserName!=='chromium','Windows WebKit cannot establish iPhone microphone capture; it still exercises native UI above.');
  test('records real media from a synthetic microphone only after a tap and releases it on leaving',async({page})=>{
    const host=await openSdkWidget(page,'study_packs',{nativeMode:true,secureHost:true,nativeStudy:true,nativeOral:true});
    await page.evaluate(()=>{
      const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (window as any).fixtureMicRequests=0;
      navigator.mediaDevices.getUserMedia=async constraints=>{(window as any).fixtureMicRequests++;const stream=await original(constraints);(window as any).fixtureMicStream=stream;return stream;};
    });
    await host.nativeRoot.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
    expect(await page.evaluate(()=>(window as any).fixtureMicRequests)).toBe(0);
    await host.nativeRoot.getByRole('button',{name:'Record pronunciation',exact:true}).click();
    await expect(host.nativeRoot.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();
    // Allow the synthetic device to produce actual encoded samples; no media events are fabricated.
    await page.waitForTimeout(350);
    await host.nativeRoot.getByRole('button',{name:'Stop recording',exact:true}).click();
    const audio=host.nativeRoot.getByLabel('Your pronunciation recording');
    await expect(audio).toBeVisible();
    expect(await audio.evaluate(async(el:HTMLAudioElement)=>(await(await fetch(el.src)).blob()).size)).toBeGreaterThan(0);
    await audio.evaluate((el:HTMLAudioElement)=>el.play());
    await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.ended)).toBe(true);
    expect(await page.evaluate(()=>(window as any).fixtureMicStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
    await page.screenshot({path:test.info().outputPath('native-recorded-clip.png')});
    await page.evaluate(()=>(window as any).nativePluginInstance.receiveDeactivateMessage({}));
    await expect(audio).toHaveCount(0);
    expect(host.calls.some(c=>/updateCardRepetitionStatus|rem.setEnablePractice|rem.setPracticeDirection/.test(c.methodName))).toBe(false);
    expect(host.errors).toEqual([]);
  });
});
