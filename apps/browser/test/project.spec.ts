import {expect,test} from '@playwright/test';
import {mockApi,specs} from './mock-api';
test('history links to current features and contributors with URL restoration',async({page})=>{
 await mockApi(page);await page.goto('/');await page.getByText('검색어 입력',{exact:true}).click();
 await expect(page.getByRole('dialog',{name:'검색어 입력'})).toContainText('사용자가 검색을 요청했습니다.');
 await page.getByRole('link',{name:'현재 기능 명세 보기 →'}).click();
 const detail=page.getByRole('article',{name:'기능 명세'});await expect(detail).toContainText('기대 동작:');await page.reload();await expect(detail).toBeVisible();
 await page.getByRole('link',{name:'참여자',exact:true}).click();await page.getByText('fixture@example.test',{exact:true}).click();
 const person=page.getByRole('article',{name:'참여자 상세'});await expect(person).toContainText('최근 명세 활동');await expect(person).toContainText('검색 기능');
 await page.getByRole('link',{name:'이 참여자의 활동 →'}).click();await expect(page).toHaveURL(/author=/);
 await page.getByRole('textbox',{name:'검색',exact:true}).fill('없는 항목');await expect(page.getByText('표시할 활동이 없습니다.',{exact:false})).toBeVisible();
});
test('reload failure labels previous snapshot and malformed responses are rejected',async({page})=>{
 await mockApi(page);await page.goto('/');await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await page.route('**/api/v1/specs*',r=>r.abort());await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('이전 조회 자료');
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:{...specs,events:'broken'}}));await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('호환되지');
});
test('mobile dark theme preserves safe Markdown and navigation',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});
 const unsafe=structuredClone(specs);unsafe.features[0]!.requirements[0]!.body='<script>window.bad=true</script>\n\n[bad](javascript:alert(1))\n\n**읽을 내용**';
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:unsafe}));await page.goto('/features/S-abcdefghij?selected=R-abcdefghij');
 const detail=page.getByRole('article',{name:'기능 명세'});await expect(detail).toContainText('읽을 내용');await expect(detail.locator('script,a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await detail.getByRole('link',{name:'제품 기능'}).click();await expect(detail).toHaveCount(0);await expect(page.getByRole('table')).toBeVisible();
 await page.getByRole('button',{name:'탐색 열기',exact:true}).click();await page.getByRole('link',{name:'참여자',exact:true}).click();await expect(page).toHaveURL(/contributors/);
});

test('load more retains rows, appends the next page and shows completion', async ({page}) => {
 await mockApi(page);
 const next = structuredClone(specs);
 next.events[0]!.key = 'd'.repeat(40)+':R-abcdefghij';
 next.events[0]!.after!.title = '이전 검색 요구사항';
 await page.route('**/api/v1/specs*', route => route.fulfill({json:new URL(route.request().url()).searchParams.has('cursor')?next:{...specs,nextCursor:10}}));
 await page.goto('/');
 await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'이전 이력 더 보기',exact:true}).click();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await expect(page.getByText('2개 이력을 불러왔습니다. 마지막 이력까지 확인했습니다.')).toBeVisible();
 await expect(page.getByRole('button',{name:'이전 이력 더 보기',exact:true})).toHaveCount(0);
});

test('initial request shows delayed skeleton then the Gentask empty illustration', async ({page}) => {
 await mockApi(page);
 let release!: () => void;
 const pending = new Promise<void>(resolve => {release = resolve;});
 await page.route('**/api/v1/specs*', async route => {await pending;await route.fulfill({json:{...specs,events:[],features:[],contributors:[]}});});
 await page.goto('/');
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCSS('opacity','1');
 release();
 await expect(page.getByRole('heading',{name:'표시할 활동이 없습니다.'})).toBeVisible();
 await expect(page.locator('img[aria-hidden="true"]').first()).toBeVisible();
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCount(0);
});

test('detail drawer opens from the timeline, keeps avatars and can be resized from the keyboard', async ({page}) => {
 await mockApi(page);await page.goto('/');
 await expect(page.getByRole('list',{name:'활동 목록'}).locator('img').first()).toBeVisible();
 await page.getByText('검색어 입력',{exact:true}).click();
 const pane=page.getByRole('dialog',{name:'검색어 입력'});
 await expect(pane.getByRole('heading',{name:'변경 후',exact:true})).toBeVisible();
 await expect(page).toHaveURL(/selected=/);
 const width=(await pane.boundingBox())!.width;
 const handle=page.getByRole('separator',{name:'변경 상세 너비 조절'});
 await handle.focus();await handle.press('ArrowLeft');
 await expect.poll(async()=>(await pane.boundingBox())!.width).not.toBe(width);
 await page.keyboard.press('Escape');await expect(pane).toHaveCount(0);await expect(page).not.toHaveURL(/selected=/);
});

test('history rows preview change reasons and mark missing ones', async ({page}) => {
 await mockApi(page);
 const event=specs.events[0]!;
 const data={...structuredClone(specs),events:[
  {...event,key:specs.head+':R-bbbbbbbbbb',id:'R-bbbbbbbbbb',types:['modified'],before:event.after,after:{...event.after,id:'R-bbbbbbbbbb',title:'검색 결과 정렬',body:'정렬 **본문**입니다.'},reasons:['정렬을 요청했습니다.','응답 순서를 고정합니다.']},
  {...event,key:specs.head+':R-cccccccccc',id:'R-cccccccccc',after:{...event.after,id:'R-cccccccccc',title:'이유 없는 변경',body:'본문만 있습니다.'},reasons:[]},
 ]};
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:data}));
 await page.goto('/');
 const rows=page.getByRole('list',{name:'활동 목록'}).getByRole('listitem');await expect(rows).toHaveCount(2);
 await expect(rows.nth(0)).toContainText('정렬을 요청했습니다. · 응답 순서를 고정합니다.');
 await expect(rows.nth(0)).not.toContainText('정렬 본문입니다.');
 await expect(rows.nth(1)).toContainText('변경 이유가 기록되지 않았습니다.');
 await rows.nth(0).getByRole('link',{name:'검색 결과 정렬'}).click();
 const pane=page.getByRole('dialog',{name:'검색 결과 정렬'});
 await expect(pane.getByRole('heading',{name:'변경 후',exact:true})).toBeVisible();
 await expect(pane).toContainText('정렬 본문입니다.');
});
