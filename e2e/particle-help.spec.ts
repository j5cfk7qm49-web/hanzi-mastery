import {test,expect} from '@playwright/test';
import {openSdkWidget} from './sdk-host';
import {courseItem,coursePack} from '../tests/helpers/course-pack';

for(const width of [786,393])test(`particle context appears below the example without its answer at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:852});
  const item=courseItem({id:'particle',section:7,kind:'text',mode:'particles',glyph:'學而習',targetParticle:'而',contextHints:[{text:'學',pinyin:'xué',meaning:'learn'},{text:'習',pinyin:'xí',meaning:'review'}],prompt:'Identify the function of 而.',answers:['conjunction'],reveal:'Model translation: learn and review.',selfGrade:true});
  const host=await openSdkWidget(page,'study_packs',{coursePack:coursePack([item]),popupLayout:true,pausedStudyCards:true}),ui=host.frame;
  await ui.getByRole('button',{name:'Practice selected (1)',exact:true}).click();const hints=ui.getByLabel('Surrounding word hints');await expect(hints).toContainText('xué');await expect(hints).toContainText('review');expect(await hints.innerText()).not.toMatch(/而|ér|conjunction/);
  await expect(ui.getByText(item.reveal,{exact:true})).toHaveCount(0);const example=(await ui.locator('.hm-pack-glyph').boundingBox())!,help=(await hints.boundingBox())!;expect(help.y).toBeGreaterThanOrEqual(example.y+example.height-1);
  expect(await ui.locator('.hm-study-packs').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:test.info().outputPath(`particle-${width}.png`)});
  await ui.getByRole('textbox',{name:'Your answer',exact:true}).fill('conjunction');await ui.getByRole('button',{name:'Save and return to dashboard',exact:true}).click();
  const child=page.frames().find(f=>f.url().startsWith('https://hanzi-plugin.test/'))!;await child.evaluate(()=>location.reload());await ui.getByRole('button',{name:'Resume (1/1)',exact:true}).click();await expect(ui.getByRole('textbox',{name:'Your answer',exact:true})).toHaveValue('conjunction');await expect(hints).toContainText('xué');
  await ui.getByRole('button',{name:'Submit and reveal',exact:true}).click();await expect(ui.getByText(item.reveal,{exact:true})).toBeVisible();await ui.getByRole('button',{name:'I got it',exact:true}).click();await expect(ui.getByRole('heading',{name:'Session complete'})).toBeVisible();expect(host.calls.filter(c=>c.methodName==='card.updateCardRepetitionStatus')).toHaveLength(1);expect(host.errors).toEqual([]);
});
