import {test,expect,type Page} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
import {syntheticHandoff} from '../tests/helpers/course-pack';
const zip=Buffer.from(zipSync(Object.fromEntries(Object.entries(syntheticHandoff()).map(([name,data])=>['handoff/data/'+name,strToU8(JSON.stringify(data))]))));
async function open(page:Page,section:string,activity:string){
  await page.setViewportSize({width:393,height:852});await page.goto('/?course');
  await page.getByLabel('Handoff ZIP').setInputFiles({name:'course.zip',mimeType:'application/zip',buffer:zip});
  await expect(page.getByRole('combobox',{name:'Section',exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Section',exact:true}).selectOption(section);await page.getByRole('combobox',{name:'Activity',exact:true}).selectOption(activity);
}
test('clean import omits obsolete categories and retains separate radical meaning recall on a phone',async({page})=>{
  await open(page,'3','radical-meaning');await page.getByRole('button',{name:'Practice selected (57)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Recall the radical’s English meaning.'})).toBeVisible();
  await expect(page.getByLabel('Your pinyin')).toHaveCount(0);await page.getByLabel('Your answer',{exact:true}).fill('wood');
  await page.getByRole('button',{name:'Submit and reveal'}).click();await page.getByRole('button',{name:'I got it',exact:true}).click();
  const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-mastery-study-pack-v1:classical-chinese-i-2026-midterm:pack')!).items);
  expect(items.some((i:{prompt:string;id:string})=>i.prompt.startsWith('Classify this sound:') || i.id==='dictionary-lookup' || i.id.startsWith('formation-rule-'))).toBe(false);
});
test('phone lookup asks for an actual entry and preserves completion through reload',async({page})=>{
  await open(page,'4','dictionary-lookup');await page.getByRole('button',{name:'Practice selected (11)',exact:true}).click();
  const region=page.getByRole('article',{name:'Dictionary lookup exercise'});await expect(region).toBeVisible();
  await expect(page.getByLabel('Your answer')).toHaveCount(0);expect('一二三四五六七八九十心').toContain(await region.locator('.hm-pack-glyph').innerText());
  await expect(region.getByRole('link',{name:/CC-CEDICT:/})).toHaveAttribute('href',/^https:\/\//);
  await region.getByRole('button',{name:'I found the entry'}).click();await page.getByRole('button',{name:'Save and return to dashboard'}).click();
  await page.reload();
  await expect(page.getByLabel('Course progress').locator('div').filter({hasText:'Attempted'})).toHaveText(/1 \/ \d+Attempted/);
  const saved=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.includes(':item:')).map(([,value])=>JSON.parse(value)));
  expect(saved).toHaveLength(1);expect(saved[0].attempts).toBe(1);expect(saved[0].lastPassed).toBe(true);
  expect(await page.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('phone sound practice pronounces consonants instead of naming linguistic categories',async({page})=>{
  await open(page,'2','sound-recognition');await page.getByRole('button',{name:'Practice selected (21)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pronounce this Pinyin consonant.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Show Pinyin',exact:true})).toHaveCount(0);await expect(page.getByText('Classify this sound:',{exact:false})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Compare with the instructor',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:"I've read aloud — compare",exact:true}).click();
  await expect(page.getByRole('heading',{name:'Compare with the instructor',exact:true})).toBeVisible();
  expect(await page.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
