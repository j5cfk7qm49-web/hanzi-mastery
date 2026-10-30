import { expect, test } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { openSdkWidget } from './sdk-host';

test.setTimeout(45000);
test('imports a dynamic Mandarin Commons recording with credits and no audio download',async({page})=>{
  const host=await openSdkWidget(page,'workbench',{focusedVocabulary:false});
  await page.route('https://hanzi-plugin.test/audio/**',route=>route.fulfill({body:gzipSync(JSON.stringify({version:1,records:[]})),contentType:'application/gzip'}));
  const requests:string[]=[];
  page.on('request',request=>{if(/wiktionary|wikimedia/.test(request.url())) requests.push(request.url());});
  await page.route('https://en.wiktionary.org/w/api.php*',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({parse:{
    title:'學習',wikitext:'==Chinese==\n{{zh-pron|m=xuéxí<!--variant note-->|ma=y|mn_note={{zh-l|word|tr=other}}|c=hok6 zaap6|ca=Cantonese.wav}}',images:['zh-xuéxí.ogg','Cantonese.wav'],
  }})}));
  await page.route('https://commons.wikimedia.org/w/api.php*',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({query:{pages:[{title:'File:Zh-xuéxí.ogg',videoinfo:[{
    url:'https://upload.wikimedia.org/original.ogg',derivatives:[{type:'audio/mpeg',src:'https://upload.wikimedia.org/recording.mp3'}],
    extmetadata:{Artist:{value:'Wei Gao &amp; Vion Nicolas'},LicenseShortName:{value:'CC BY 2.0 fr'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/2.0/fr/'}},
  }]}]}})}));
  await host.frame.getByLabel('Words to look up').fill('學習');
  await host.frame.getByRole('button',{name:'Import words',exact:true}).click();
  await host.frame.getByRole('button',{name:'Edit imported 學習'}).click();
  await expect(host.frame.getByLabel('Shared reference audio URL')).toHaveValue('https://upload.wikimedia.org/recording.mp3');
  await expect(host.frame.getByText('Wei Gao & Vion Nicolas',{exact:false})).toBeVisible();
  await expect(host.frame.getByRole('link',{name:'CC BY 2.0 fr'})).toBeVisible();
  const schemas=host.calls.filter(call=>call.methodName==='rem.setPowerupProperty').map(call=>JSON.parse((call.args.value as string[])[0]));
  expect(schemas.find(schema=>schema.skill==='listening').audioSource.provider).toBe('Wikimedia Commons');
  expect(requests.filter(url=>url.startsWith('https://upload.wikimedia.org'))).toEqual([]);
  expect(requests.some(url=>url.includes('Cantonese.wav'))).toBe(false);
  expect(host.errors).toEqual([]);
});

test('recording lookup failure keeps the CC-CEDICT word and its cards usable',async({page})=>{
  const host=await openSdkWidget(page,'workbench',{focusedVocabulary:false});
  await page.route('https://hanzi-plugin.test/audio/**',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.route('https://en.wiktionary.org/w/api.php*',route=>route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'Unavailable'}));
  await host.frame.getByLabel('Words to look up').fill('學習');
  await host.frame.getByRole('button',{name:'Import words',exact:true}).click();
  await expect(host.frame.getByRole('button',{name:'Edit imported 學習'})).toBeVisible({timeout:20000});
  await expect(host.frame.getByText('Recording lookup unavailable; add audio on the Word page.')).toBeVisible();
  await host.frame.getByRole('button',{name:'Edit imported 學習'}).click();
  await expect(host.frame.getByLabel('Edit study meanings')).toHaveValue(/to study/);
  await expect(host.frame.getByLabel('Shared reference audio URL')).toHaveValue('');
  expect(host.errors).toEqual([]);
});

test('a radical variant shares the base recording while retaining its exact writing target',async({page})=>{
  const host=await openSdkWidget(page,'workbench',{focusedVocabulary:false});
  await host.frame.getByLabel('Words to look up').fill('忄');
  await host.frame.getByRole('button',{name:'Import words',exact:true}).click();
  await expect(host.frame.getByRole('button',{name:'Edit imported 忄'})).toBeVisible({timeout:20000});
  const schemas=host.calls.filter(call=>call.methodName==='rem.setPowerupProperty').map(call=>JSON.parse((call.args.value as string[])[0]));
  const word=schemas.find(schema=>schema.version===2&&!schema.skill);
  expect(word).toMatchObject({traditional:'忄',pinyin:'xīn',audioSource:{traditional:'忄',recordedForm:'心',pinyin:'xīn'}});
  expect(schemas.find(schema=>schema.skill==='writing').traditional).toBe('忄');
  expect(schemas.find(schema=>schema.skill==='listening')).toMatchObject({traditional:'忄',audioSource:{recordedForm:'心'}});
  expect(host.errors).toEqual([]);
});

test('single-character import can reuse a complete matching syllable while retaining its written form',async({page})=>{
  const host=await openSdkWidget(page,'workbench',{focusedVocabulary:false});
  await host.frame.getByLabel('Words to look up').fill('明');
  await host.frame.getByRole('button',{name:'Import words',exact:true}).click();
  await expect(host.frame.getByRole('button',{name:'Edit imported 明'})).toBeVisible({timeout:20000});
  await host.frame.getByRole('button',{name:'Edit imported 明'}).click();
  await expect(host.frame.getByLabel('Edit Traditional characters')).toHaveValue('明');
  await expect(host.frame.getByLabel('Edit pinyin')).toHaveValue('míng');
  const schemas=host.calls.filter(call=>call.methodName==='rem.setPowerupProperty').map(call=>JSON.parse((call.args.value as string[])[0]));
  expect(schemas.find(schema=>schema.skill==='listening')).toMatchObject({traditional:'明',audioSource:{provider:'Shtooka',recordedForm:'鸣',pinyin:'míng'}});
  expect(host.errors).toEqual([]);
});

test('MOE fills a reading gap even when Wikimedia is unavailable and does not fetch audio during import',async({page})=>{
  const host=await openSdkWidget(page,'workbench',{focusedVocabulary:false});
  await page.route('https://en.wiktionary.org/w/api.php*',route=>route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'Unavailable'}));
  const audioRequests:string[]=[];
  page.on('request',request=>{if(request.url().includes('dict.concised.moe.edu.tw')) audioRequests.push(request.url());});
  await host.frame.getByLabel('Words to look up').fill('耳');
  await host.frame.getByRole('button',{name:'Import words',exact:true}).click();
  await expect(host.frame.getByRole('button',{name:'Edit imported 耳'})).toBeVisible({timeout:20000});
  await host.frame.getByRole('button',{name:'Edit imported 耳'}).click();
  await expect(host.frame.getByLabel('Shared reference audio URL')).toHaveValue('https://dict.concised.moe.edu.tw/sound/word/5829.mp3');
  await expect(host.frame.getByRole('link',{name:'CC BY-ND 3.0 TW'})).toBeVisible();
  const schemas=host.calls.filter(call=>call.methodName==='rem.setPowerupProperty').map(call=>JSON.parse((call.args.value as string[])[0]));
  expect(schemas.find(schema=>schema.skill==='listening')).toMatchObject({traditional:'耳',audioSource:{provider:'MOE Concise',recordedForm:'耳',pinyin:'ěr'}});
  expect(audioRequests).toEqual([]);
  expect(host.errors).toEqual([]);
});
