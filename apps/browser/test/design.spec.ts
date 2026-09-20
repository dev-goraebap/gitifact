import {test, expect} from '@playwright/test';
import {mockApi, specs, changeBodies, serve, type Fixture } from './mock-api';
const design={title:'검색 구현 설계',body:'## 처리 흐름\n<!-- gitifact-ref: R-abcdefghij -->\n검색 색인을 조회합니다.\n\n<!-- gitifact-ref: R-zzzzzzzzzz -->',requirements:['R-abcdefghij','R-zzzzzzzzzz'],sources:[{title:'레이아웃 지침',path:'../../wiki/frontend/layout.md',note:'열 폭 기준'},{title:'React 참조',url:'https://react.dev/reference/react',note:'훅 규칙'},{title:'옮겨진 페이지',path:'../../wiki/gone.md'}]};
// The list names the design change; its text on both sides is what the drawer reads from the change endpoint.
const designKey=specs.head+':S-abcdefghij';
const designSide={id:'S-abcdefghij',specId:'S-abcdefghij',path:'.gitifact/spec/search/design.md',title:design.title};
changeBodies[designKey]={before:{...designSide,body:'이전 설계'},after:{...designSide,body:design.body}};
function data(): Fixture {return {...structuredClone(specs), features:specs.features.map(f=>({...f,design})), events:[
 {...specs.events[0]!,key:designKey,id:'S-abcdefghij',kind:'design' as const,types:['modified' as const],before:designSide,after:designSide,reasons:['검색 부하를 줄입니다.']},...specs.events]};}
test('design tab, explicit references and URL restoration',async({page})=>{
 await mockApi(page);await serve(page, data());
 await page.goto('/features/S-abcdefghij');await page.getByRole('tab',{name:'설계',exact:true}).click();
 await expect(page).toHaveURL(/tab=design/);await expect(page.getByRole('tabpanel',{name:'설계'})).toContainText('검색 색인을 조회합니다.');
 await expect(page.getByText('R-zzzzzzzzzz (현재 명세에 없음)')).toBeVisible();
 await page.reload();await expect(page.getByRole('tab',{name:'설계',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('link',{name:'R-abcdefghij',exact:true}).click();await expect(page).toHaveURL(/tab=requirements/);await expect(page.locator('#R-abcdefghij')).toBeVisible();
 await page.goBack();await expect(page.getByRole('tab',{name:'설계',exact:true})).toHaveAttribute('aria-selected','true');
 await page.screenshot({path:'../../.tmp/design-development/features-design.png',fullPage:true});
});
test('mixed commit history, design filter and before/after panel',async({page})=>{
 await mockApi(page);await serve(page, data());await page.goto('/activity');
 await expect(page.getByText('ccccccc',{exact:true})).toHaveCount(1);
 await expect(page.getByRole('list',{name:'이 이유로 바뀐 기록'})).toHaveCount(2);
 await page.getByRole('link',{name:'검색 구현 설계',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'검색 구현 설계'});await expect(detail).toContainText('검색 부하를 줄입니다.');
 await detail.getByText('변경 전',{exact:true}).click();await expect(detail).toContainText('이전 설계');
 await detail.getByRole('link',{name:'현재 기능 명세 보기 →'}).click();await expect(page.getByRole('tab',{name:'설계',exact:true})).toHaveAttribute('aria-selected','true');
 const rows=page.getByRole('list',{name:'이 이유로 바뀐 기록'}).getByRole('listitem');
 await page.goto('/activity?document=design');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('설계');await expect(page.getByRole('link',{name:'검색 구현 설계',exact:true})).toBeVisible();
 await page.goto('/activity?document=requirement');await expect(rows).toHaveCount(1);await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
});
test('optional design empty state and mobile safe Markdown',async({page})=>{
 await mockApi(page);await page.goto('/features/S-abcdefghij?tab=design');await expect(page.getByRole('heading',{name:'아직 작성된 설계가 없습니다.'})).toBeVisible();
 const payload=data();payload.features[0]!.design!.body+='<script>window.bad=true</script>\n[bad](javascript:alert(1))';
 await serve(page, payload);await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.reload();
 await expect(page.getByRole('tabpanel',{name:'설계'})).toContainText('검색 색인');await expect(page.locator('article script,article a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('design sources list above the body: wiki pages open in the app, URLs open in a new tab, missing pages are disabled',async({page})=>{
 await mockApi(page);await serve(page, data());
 await page.goto('/features/S-abcdefghij?tab=design');
 const sources=page.getByRole('tabpanel',{name:'설계'}).getByLabel('참고 문서');
 await expect(sources).toContainText('열 폭 기준');await expect(sources).toContainText('frontend/layout.md');
 const external=sources.getByRole('link',{name:'React 참조'});
 await expect(external).toHaveAttribute('href','https://react.dev/reference/react');await expect(external).toHaveAttribute('target','_blank');await expect(sources).toContainText('react.dev');
 await expect(sources.getByRole('link',{name:'옮겨진 페이지'})).toHaveCount(0);await expect(sources.getByText('옮겨진 페이지',{exact:true})).toBeVisible();await expect(sources).toContainText('페이지가 없습니다: .gitifact/wiki/gone.md');
 expect(await sources.boundingBox().then(b=>b!.y)).toBeLessThan(await page.getByText('검색 색인을 조회합니다.').boundingBox().then(b=>b!.y));
 await sources.getByRole('link',{name:'레이아웃 지침'}).click();await expect(page).toHaveURL(/\/wiki\/W-bbbbbbbbbb$/);
});
