import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {openSdkWidget} from './sdk-host';

// Capture comes from Chromium's synthetic device, never the user's microphone.
// The production getUserMedia and MediaRecorder calls are not mocked.
test.use({launchOptions:async({browserName},use)=>{
  await use(browserName==='chromium'?{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}:{});
}});

const currentSandbox='allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
async function saveEvidence(name:string,value:unknown){
  const path=test.info().outputPath(name+'.json');
  await writeFile(path,JSON.stringify(value,null,2));
  await test.info().attach(name,{path,contentType:'application/json'});
}
const configurations=[
  {name:'current opaque RemNote frame',sandbox:currentSandbox,allow:undefined,allowed:false,error:'SecurityError'},
  {name:'microphone delegation alone',sandbox:currentSandbox,allow:'microphone',allowed:false,error:'SecurityError'},
  {name:'origin preservation alone',sandbox:currentSandbox+' allow-same-origin',allow:undefined,allowed:false,error:'NotAllowedError'},
  {name:'origin preservation and microphone delegation',sandbox:currentSandbox+' allow-same-origin',allow:'microphone',allowed:true,error:''},
  {name:'delegation overridden by a restrictive host header',sandbox:currentSandbox+' allow-same-origin',allow:'microphone',header:'()',allowed:false,error:'NotAllowedError'},
] as const;

for(const configuration of configurations){
  test(`sandbox microphone: ${configuration.name}`,async({page,browserName})=>{
    test.skip(browserName!=='chromium'&&configuration.allowed,'Windows WebKit cannot verify successful iPhone microphone capture.');
    const host=await openSdkWidget(page,'study_packs',{
      secureHost:true,nativeStudy:true,nativeOral:true,
      iframeSandbox:configuration.sandbox,iframeAllow:configuration.allow,
      hostMicrophonePolicy:'header' in configuration?configuration.header:undefined,
    });
    const child=page.frames().find(frame=>frame.url().startsWith('https://hanzi-plugin.test/'))!;
    const before=await child.evaluate(()=>{
      const probe={secure:isSecureContext,origin:globalThis.origin,mediaDevices:!!navigator.mediaDevices,
        recorder:typeof MediaRecorder,policy:(document as any).permissionsPolicy?.allowsFeature('microphone')??(document as any).featurePolicy?.allowsFeature('microphone')??null,
        requests:0,errorName:'',errorMessage:'',tracks:[] as MediaStreamTrack[],parentDOMAccessible:false};
      try{void parent.document.body;probe.parentDOMAccessible=true;}catch{}
      (window as any).microphoneProbe=probe;
      if(navigator.mediaDevices?.getUserMedia){
        const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia=async constraints=>{
          probe.requests++;
          try{const stream=await capture(constraints);probe.tracks.push(...stream.getTracks());return stream;}
          catch(error){probe.errorName=(error as DOMException).name;probe.errorMessage=(error as DOMException).message;throw error;}
        };
      }
      return {...probe,tracks:undefined};
    });
    expect(before.secure).toBe(true);
    expect(before.parentDOMAccessible).toBe(false);
    await host.frame.getByRole('button',{name:'Practice selected (1)',exact:true}).click();
    await host.frame.getByRole('button',{name:'Record pronunciation',exact:true}).click();
    if(configuration.allowed){
      await expect(host.frame.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();
      await page.waitForTimeout(350);
      await host.frame.getByRole('button',{name:'Stop recording',exact:true}).click();
      const audio=host.frame.getByLabel('Your pronunciation recording');
      await expect(audio).toBeVisible();
      expect(await audio.evaluate(async(el:HTMLAudioElement)=>(await(await fetch(el.src)).blob()).size)).toBeGreaterThan(0);
      await audio.evaluate((el:HTMLAudioElement)=>el.play());
      await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.ended)).toBe(true);
    }else{
      await expect(host.frame.getByRole('alert')).toContainText('Microphone access is unavailable');
      await expect(host.frame.getByLabel('Your pronunciation recording')).toHaveCount(0);
    }
    const result=await child.evaluate(()=>{
      const probe=(window as any).microphoneProbe;
      return {...probe,tracks:probe.tracks.map((track:MediaStreamTrack)=>({kind:track.kind,state:track.readyState}))};
    });
    await saveEvidence('microphone-policy-result',{browser:browserName,configuration,before,result});
    if(browserName==='chromium'){
      expect(result.requests).toBe(1);
      expect(result.errorName).toBe(configuration.error);
      if(configuration.sandbox.includes('allow-same-origin'))expect(result.policy).toBe(configuration.allowed);
      else expect(result.origin).toBe('null');
    }
    expect(result.tracks.every((track:{state:string})=>track.state==='ended')).toBe(true);
    expect(host.calls.some(call=>/updateCardRepetitionStatus|rem.createRem|rem.setEnablePractice|rem.setPracticeDirection/.test(call.methodName))).toBe(false);
    expect(host.errors).toEqual([]);
  });
}

test('an inner iframe cannot grant itself permissions withheld by the RemNote frame',async({page,browserName})=>{
  test.skip(browserName!=='chromium','The precise browser security error is verified with Chromium.');
  await openSdkWidget(page,'study_packs',{secureHost:true,nativeStudy:true,nativeOral:true,iframeSandbox:currentSandbox});
  const child=page.frames().find(frame=>frame.url().startsWith('https://hanzi-plugin.test/'))!;
  await page.route('https://hanzi-helper.test/nested',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><button>Request microphone</button><script>document.querySelector("button").onclick=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(track=>track.stop());window.result="granted";}catch(error){window.result=error.name;}};</script>'}));
  await child.evaluate(()=>{
    const nested=document.createElement('iframe');nested.id='nested-recorder';nested.sandbox.add('allow-scripts','allow-same-origin');nested.allow='microphone';nested.src='https://hanzi-helper.test/nested';document.body.append(nested);
  });
  const nested=page.frameLocator('#sdk-widget').frameLocator('#nested-recorder');
  await nested.getByRole('button',{name:'Request microphone',exact:true}).click();
  await expect.poll(()=>nested.locator('body').evaluate(()=>(window as any).result)).toBe('SecurityError');
  await saveEvidence('nested-frame-result',{error:await nested.locator('body').evaluate(()=>(window as any).result)});
});

test('a separate HTTPS recording window can return a clip to an opaque sandbox (prototype only)',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Successful capture from the separate window is a Chromium proof, not an iPhone claim.');
  await openSdkWidget(page,'study_packs',{secureHost:true,nativeStudy:true,nativeOral:true,iframeSandbox:currentSandbox});
  const child=page.frames().find(frame=>frame.url().startsWith('https://hanzi-plugin.test/'))!;
  const helperURL='https://hanzi-plugin.test/microphone-helper.html';
  await page.context().route(helperURL,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><button id="start">Record in this window</button><button id="stop" disabled>Stop and return clip</button><script>
    let stream,recorder;const chunks=[];const nonce=location.hash.slice(1);
    document.querySelector('#start').onclick=async()=>{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(stream);
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());opener.postMessage({type:'microphone-clip',nonce,clip:new Blob(chunks,{type:recorder.mimeType})},'*');};
      recorder.start();document.querySelector('#start').disabled=true;document.querySelector('#stop').disabled=false;
    };
    document.querySelector('#stop').onclick=()=>{recorder.stop();document.querySelector('#stop').disabled=true;};
    addEventListener('pagehide',()=>stream?.getTracks().forEach(track=>track.stop()));
  </script>`}));
  await child.evaluate(helperURL=>{
    const nonce=crypto.randomUUID();let helper:Window|null=null;
    const button=document.createElement('button');button.textContent='Open recording helper prototype';
    button.onclick=()=>{helper=window.open(helperURL+'#'+nonce,'_blank');};document.body.append(button);
    addEventListener('message',event=>{
      if(event.source!==helper||event.origin!==new URL(helperURL).origin||event.data?.type!=='microphone-clip'||event.data.nonce!==nonce||!(event.data.clip instanceof Blob))return;
      const clip=event.data.clip as Blob;(window as any).helperResult={size:clip.size,type:clip.type};
      const audio=document.createElement('audio');audio.setAttribute('aria-label','Helper recording');audio.controls=true;audio.src=URL.createObjectURL(clip);document.body.append(audio);
    });
  },helperURL);
  const opened=page.waitForEvent('popup');
  await page.frameLocator('#sdk-widget').getByRole('button',{name:'Open recording helper prototype',exact:true}).click();
  const helper=await opened;
  await helper.getByRole('button',{name:'Record in this window',exact:true}).click();
  await expect(helper.getByRole('button',{name:'Stop and return clip',exact:true})).toBeEnabled();
  await page.waitForTimeout(350);
  await helper.getByRole('button',{name:'Stop and return clip',exact:true}).click();
  await expect.poll(()=>child.evaluate(()=>(window as any).helperResult?.size??0)).toBeGreaterThan(0);
  const audio=page.frameLocator('#sdk-widget').getByLabel('Helper recording');
  await audio.evaluate((el:HTMLAudioElement)=>el.play());
  await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.ended)).toBe(true);
  await saveEvidence('separate-window-prototype',await child.evaluate(()=>(window as any).helperResult));
  await helper.close();
});
