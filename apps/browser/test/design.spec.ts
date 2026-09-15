import {test, expect} from '@playwright/test';
import {mockApi, specs} from './mock-api';
const design={title:'검색 구현 설계',body:'## 처리 흐름\n<!-- gitifact-ref: R-abcdefghij -->\n검색 색인을 조회합니다.\n\n<!-- gitifact-ref: R-zzzzzzzzzz -->',requirements:['R-abcdefghij','R-zzzzzzzzzz']};
function data(){return {...structuredClone(specs), features:specs.features.map(f=>({...f,design})), events:[
 {...specs.events[0]!,key:specs.head+':S-abcdefghij',id:'S-abcdefghij',kind:'design',types:['modified'],before:{...specs.events[0]!.after,title:design.title,body:'이전 설계'},after:{...specs.events[0]!.after,id:'S-abcdefghij',title:design.title,body:design.body,path:'.gitifact/spec/search/design.md'},reasons:['검색 부하를 줄입니다.']},...specs.events]};}
test('design tab, explicit references and URL restoration',async({page})=>{
 await mockApi(page);await page.route('**/api/v1/specs*',r=>r.fulfill({json:data()}));
 await page.goto('/features/S-abcdefghij');await page.getByRole('tab',{name:'설계',exact:true}).click();
 await expect(page).toHaveURL(/tab=design/);await expect(page.getByRole('tabpanel',{name:'설계'})).toContainText('검색 색인을 조회합니다.');
 await expect(page.getByText('R-zzzzzzzzzz (현재 명세에 없음)')).toBeVisible();
 await page.reload();await expect(page.getByRole('tab',{name:'설계',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('link',{name:'R-abcdefghij',exact:true}).click();await expect(page).toHaveURL(/tab=requirements/);await expect(page.locator('#R-abcdefghij')).toBeVisible();
 await page.goBack();await expect(page.getByRole('tab',{name:'설계',exact:true})).toHaveAttribute('aria-selected','true');
 await page.screenshot({path:'../../.tmp/design-development/features-design.png',fullPage:true});
});
test('mixed commit history, design filter and before/after panel',async({page})=>{
 await mockApi(page);await page.route('**/api/v1/specs*',r=>r.fulfill({json:data()}));await page.goto('/');
 await expect(page.getByText('ccccccc',{exact:true})).toHaveCount(2);
 await page.getByRole('link',{name:'검색 구현 설계',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'검색 구현 설계'});await expect(detail).toContainText('검색 부하를 줄입니다.');
 await detail.getByText('변경 전',{exact:true}).click();await expect(detail).toContainText('이전 설계');
 await detail.getByRole('link',{name:'현재 기능 명세 보기 →'}).click();await expect(page.getByRole('tab',{name:'설계',exact:true})).toHaveAttribute('aria-selected','true');
 const rows=page.getByRole('list',{name:'활동 목록'}).getByRole('listitem');
 await page.goto('/?document=design');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('설계');await expect(page.getByRole('link',{name:'검색 구현 설계',exact:true})).toBeVisible();
 await page.goto('/?document=requirement');await expect(rows).toHaveCount(1);await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
});
test('optional design empty state and mobile safe Markdown',async({page})=>{
 await mockApi(page);await page.goto('/features/S-abcdefghij?tab=design');await expect(page.getByRole('heading',{name:'아직 작성된 설계가 없습니다.'})).toBeVisible();
 const payload=data();payload.features[0]!.design.body+='<script>window.bad=true</script>\n[bad](javascript:alert(1))';
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:payload}));await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.reload();
 await expect(page.getByRole('tabpanel',{name:'설계'})).toContainText('검색 색인');await expect(page.locator('article script,article a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
