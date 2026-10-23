import {test,expect} from '@playwright/test';
import {REVIEW_HOST_CSS} from '../src/ui/reviewHostCss';
for(const beautiful of [false,true]) test(`grouped study cards hide native ancestor answers in ${beautiful?'Beautiful':'Compact'} queue`,async({page})=>{
  const content=`<div class="ancestor">SECRET CHARACTER ANSWER</div><div class="native-question">Native prompt</div><div class="study-wrapper"><iframe data-plugin-id="hanzi_mastery_handwriting_v1" src="about:blank?widgetName=recall_review" title="Study"></iframe></div>`;
  await page.setContent(`<style>${REVIEW_HOST_CSS}</style><div class="rn-queue"><main class="rn-queue__content">${beautiful?`<div class="insights"><aside>Statistics</aside><div class="stage">${content}</div></div>`:content}</main><button>Show Answer</button></div>`);
  await expect(page.getByText('SECRET CHARACTER ANSWER')).toBeHidden();
  await expect(page.getByText('Native prompt')).toBeHidden();
  await expect(page.locator('iframe')).toBeVisible();
  await expect(page.getByRole('button',{name:'Show Answer'})).toBeVisible();
});
