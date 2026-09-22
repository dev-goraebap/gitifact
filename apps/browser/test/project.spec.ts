import {expect,test} from '@playwright/test';
import {mockApi,specs,changeBodies,serve,checkoutOf} from './mock-api';
test('history links to current features and contributors with URL restoration',async({page})=>{
 await mockApi(page);await page.goto('/activity');await page.getByText('검색어 입력',{exact:true}).click();
 await expect(page.getByRole('dialog',{name:'검색어 입력'})).toContainText('사용자가 검색을 요청했습니다.');
 await page.getByRole('link',{name:'현재 기능 명세 보기 →'}).click();
 const detail=page.getByRole('article',{name:'기능 명세'});await expect(detail).toContainText('기대 동작:');await page.reload();await expect(detail).toBeVisible();
 await page.getByRole('link',{name:'참여자',exact:true}).click();await page.getByText('fixture@example.test',{exact:true}).click();
 const person=page.getByRole('article',{name:'참여자 상세'});await expect(person).toContainText('최근 명세 활동');await expect(person).toContainText('검색 기능');
 await page.getByRole('link',{name:'이 참여자의 활동 →'}).click();await expect(page).toHaveURL(/author=/);
 await page.getByRole('textbox',{name:'검색',exact:true}).fill('없는 항목');await expect(page.getByText('표시할 활동이 없습니다.',{exact:false})).toBeVisible();
});
test('reload failure labels previous snapshot and malformed responses are rejected',async({page})=>{
 await mockApi(page);await page.goto('/activity');await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await page.route('**/api/v1/specs*',r=>r.abort());await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('이전 조회 자료');
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:{...checkoutOf(specs),features:'broken'}}));await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('호환되지');
});
test('mobile dark theme preserves safe Markdown and navigation',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});
 const unsafe=structuredClone(specs);unsafe.features[0]!.requirements[0]!.body='<script>window.bad=true</script>\n\n[bad](javascript:alert(1))\n\n**읽을 내용**';
 await serve(page, unsafe);await page.goto('/features/S-abcdefghij?selected=R-abcdefghij');
 const detail=page.getByRole('article',{name:'기능 명세'});await expect(detail).toContainText('읽을 내용');await expect(detail.locator('script,a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await detail.getByRole('link',{name:'← 기능별 요구사항'}).click();await expect(detail).toHaveCount(0);await expect(page.getByRole('table')).toBeVisible();
 await page.getByRole('button',{name:'탐색 열기',exact:true}).click();await page.getByRole('link',{name:'참여자',exact:true}).click();await expect(page).toHaveURL(/contributors/);
});

// Fifty-one changes: the server answers fifty, and the last one comes with "load more".
function longHistory(){
 const data=structuredClone(specs);
 const base=data.events[0]!;
 data.events=[base,...Array.from({length:50},(_,i)=>({...base,key:'d'.repeat(40)+':R-'+'abcdefgh'+'abcdefghijklmnopqrstuvwxyz234567'[i>>5]+'abcdefghijklmnopqrstuvwxyz234567'[i&31],id:'R-x',after:{...base.after!,title:i===49?'이전 검색 요구사항':'이전 변경 '+i}}))];
 return data;
}
test('load more retains rows, appends the next page and shows completion', async ({page}) => {
 await mockApi(page, longHistory());
 await page.goto('/activity');
 await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await expect(page.getByText('전체 51건 중 50건을 보고 있습니다.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'이전 이력 더 보기',exact:true}).click();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await expect(page.getByText('전체 51건 중 51건을 보고 있습니다. 마지막 이력까지 확인했습니다.')).toBeVisible();
 await expect(page.getByRole('button',{name:'이전 이력 더 보기',exact:true})).toHaveCount(0);
});

test('loaded history is kept across screens, and refresh re-reads the checkout but not a HEAD it already read', async ({page}) => {
 // Every screen shares one history query per HEAD and filter, so leaving and coming back asks the server nothing.
 await mockApi(page, longHistory());
 let history = 0; let checkout = 0;
 page.on('request', request => { const path = new URL(request.url()).pathname; if (path === '/api/v1/history') history++; if (path === '/api/v1/specs') checkout++; });
 await page.goto('/activity');
 await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'이전 이력 더 보기',exact:true}).click();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 expect(history).toBe(2);
 await page.getByRole('link',{name:'제품 개요',exact:true}).click();
 await expect(page.getByRole('article',{name:'제품 개요'})).toBeVisible();
 await page.getByRole('link',{name:'활동',exact:true}).click();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 expect(history).toBe(2);
 // Refresh re-reads the checkout. The history of the same HEAD is the same history, so it is not asked again.
 const before = checkout;
 await page.getByRole('button',{name:'새로고침'}).click();
 await expect.poll(() => checkout).toBe(before + 1);
 expect(history).toBe(2);
});

test('initial request shows delayed skeleton then the Gentask empty illustration', async ({page}) => {
 await mockApi(page);
 let release!: () => void;
 const pending = new Promise<void>(resolve => {release = resolve;});
 const empty={...structuredClone(specs),events:[],features:[],contributors:[]};
 await serve(page, empty);
 await page.route('**/api/v1/specs*', async route => {await pending;await route.fulfill({json:checkoutOf(empty)});});
 await page.goto('/activity');
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCSS('opacity','1');
 release();
 await expect(page.getByRole('heading',{name:'표시할 활동이 없습니다.'})).toBeVisible();
 await expect(page.locator('img[aria-hidden="true"]').first()).toBeVisible();
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCount(0);
});

test('detail drawer opens from the timeline, keeps avatars and can be resized from the keyboard', async ({page}) => {
 await mockApi(page);await page.goto('/activity');
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
  {...event,key:specs.head+':R-bbbbbbbbbb',id:'R-bbbbbbbbbb',types:['modified' as const],before:event.after,after:{...event.after!,id:'R-bbbbbbbbbb',title:'검색 결과 정렬'},reasons:['정렬을 요청했습니다.','응답 순서를 고정합니다.']},
  {...event,key:specs.head+':R-cccccccccc',id:'R-cccccccccc',after:{...event.after!,id:'R-cccccccccc',title:'이유 없는 변경'},reasons:[]},
 ]};
 // The rows carry names only; the drawer reads the text on both sides by key.
 changeBodies[specs.head+':R-bbbbbbbbbb']={before:{...event.after!,body:'이전 본문'},after:{...event.after!,id:'R-bbbbbbbbbb',title:'검색 결과 정렬',body:'정렬 **본문**입니다.'}};
 changeBodies[specs.head+':R-cccccccccc']={before:null,after:{...event.after!,id:'R-cccccccccc',title:'이유 없는 변경',body:'본문만 있습니다.'}};
 await serve(page, data);
 await page.goto('/activity');
 // Both changes ride on one commit, so the timeline has one entry and each recorded reason heads its own records.
 const commits=page.getByRole('list',{name:'활동 목록'}).locator('> li');await expect(commits).toHaveCount(1);
 await expect(commits.first()).toContainText('기록 2건');
 const reasons=commits.first().getByRole('list',{name:'이 이유로 바뀐 기록'});await expect(reasons).toHaveCount(2);
 await expect(commits.first()).toContainText('정렬을 요청했습니다.');
 await expect(commits.first()).toContainText('응답 순서를 고정합니다.');
 await expect(commits.first()).not.toContainText('정렬 본문입니다.');
 await expect(commits.first()).toContainText('변경 이유가 기록되지 않았습니다.');
 await reasons.nth(0).getByRole('link',{name:'검색 결과 정렬'}).click();
 const pane=page.getByRole('dialog',{name:'검색 결과 정렬'});
 await expect(pane.getByRole('heading',{name:'변경 내용',exact:true})).toBeVisible();
 await expect(pane).toContainText('정렬 본문입니다.');
 const reveal=pane.getByRole('separator',{name:'변경 전 드러내기'});await expect(reveal).toBeVisible();
 const before=pane.getByLabel('변경 전',{exact:true});expect(await before.evaluate(el=>getComputedStyle(el).clipPath)).toContain('100%');
 await pane.getByRole('button',{name:'변경 전',exact:true}).click();await expect.poll(async()=>before.evaluate(el=>getComputedStyle(el).clipPath)).toContain('0px');
});

test('a reason is written once over the records it explains, and each day is marked once', async ({page}) => {
 await mockApi(page);
 const event=specs.events[0]!;
 const shared='한 번만 적히는 이유입니다.';
 const record=(commit:string,date:string,id:string,title:string,reason:string)=>
  ({...event,commit,date,key:commit+':'+id,id,after:{...event.after!,id,title},reasons:[reason]});
 const older='d'.repeat(40);
 const data={...structuredClone(specs),events:[
  record(specs.head!,'2026-09-14T00:00:00Z','R-1111111111','첫 기록',shared),
  record(specs.head!,'2026-09-14T00:00:00Z','R-2222222222','둘째 기록',shared),
  record(specs.head!,'2026-09-14T00:00:00Z','R-3333333333','셋째 기록',shared),
  record(older,'2026-09-12T00:00:00Z','R-4444444444','앞선 기록','다른 날의 이유입니다.'),
 ]};
 await serve(page, data);
 await page.goto('/activity');
 const commits=page.getByRole('list',{name:'활동 목록'}).locator('> li');await expect(commits).toHaveCount(2);
 // The same sentence is stored against all three records. Printing it per record is what made the timeline unreadable.
 await expect(page.getByText(shared,{exact:true})).toHaveCount(1);
 await expect(commits.first().getByRole('list',{name:'이 이유로 바뀐 기록'}).getByRole('listitem')).toHaveCount(3);
 await expect(commits.first()).toContainText('기록 3건');
 // Each calendar day is named where it turns over, and a commit alone on its day carries no count.
 await expect(commits.first()).toContainText('2026년 9월 14일');
 await expect(commits.nth(1)).toContainText('2026년 9월 12일');
 await expect(commits.nth(1)).not.toContainText('기록 1건');
});

test('a list row carries no body; opening it reads the change once and shows its text', async ({page}) => {
 await mockApi(page);
 let reads = 0;
 await page.route(url => url.pathname === '/api/v1/change', async route => { reads++;
  const key = new URL(route.request().url()).searchParams.get('key');
  await route.fulfill({json:{contract:'browser-change',version:2,sessionId:specs.sessionId,event:specs.events[0],before:null,after:{id:'R-abcdefghij',kind:'requirement',title:'검색어 입력',description:'검색어 입력',body:'본문은 **열 때** 읽습니다.',specId:'S-abcdefghij',path:'.gitifact/spec/search/requirements/r-abcdefghij.md'}}}); });
 await page.goto('/activity');
 await page.getByText('검색어 입력',{exact:true}).click();
 const drawer = page.getByRole('dialog',{name:'검색어 입력'});
 await expect(drawer).toContainText('본문은 열 때 읽습니다.');
 await expect(drawer).toContainText('사용자가 검색을 요청했습니다.');
 // Closing and reopening the same entry does not ask again: a change never changes.
 await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0);
 await page.getByText('검색어 입력',{exact:true}).click();
 await expect(page.getByRole('dialog',{name:'검색어 입력'})).toContainText('본문은 열 때 읽습니다.');
 expect(reads).toBe(1);
});

test('a change that cannot be read says so in the drawer instead of leaving it blank', async ({page}) => {
 await mockApi(page);
 await page.route(url => url.pathname === '/api/v1/change', route => route.fulfill({status:503,json:{contract:'browser-http-error',version:1,error:{code:'INTERNAL_ERROR',message:'읽기 실패'}}}));
 await page.goto('/activity');
 await page.getByText('검색어 입력',{exact:true}).click();
 await expect(page.getByRole('dialog',{name:'검색어 입력'}).getByRole('alert')).toContainText('변경 내용을 불러오지 못했습니다.');
});

test('a filter and a search word find changes that were never loaded, with the whole count', async ({page}) => {
 await mockApi(page, longHistory());
 await page.goto('/activity');
 await expect(page.getByText('전체 51건 중 50건을 보고 있습니다.',{exact:false})).toBeVisible();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toHaveCount(0);
 // The fifty-first change is not on screen, and the word still finds it: the server searches all of history.
 await page.getByRole('textbox',{name:'검색',exact:true}).fill('이전 검색');
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 await expect(page.getByText('전체 1건 중 1건을 보고 있습니다.',{exact:false})).toBeVisible();
});

test('a link to any change opens its drawer, loaded or not', async ({page}) => {
 const data = longHistory(); const last = data.events.at(-1)!;
 changeBodies[last.key] = { before: null, after: { ...last.after!, body: '오래된 변경의 본문' } };
 await mockApi(page, data);
 await page.goto('/activity?selected=' + encodeURIComponent(last.key));
 const drawer = page.getByRole('dialog', { name: '이전 검색 요구사항' });
 await expect(drawer).toContainText('오래된 변경의 본문');
});

test('the overview counts all of history, and a contributor page asks for that person\'s changes', async ({page}) => {
 await mockApi(page, longHistory());
 await page.goto('/product');
 await expect(page.getByText('전체 활동 51건').first()).toBeVisible();
 await page.goto('/contributors/' + encodeURIComponent('fixture@example.test'));
 const person = page.getByRole('article', { name: '참여자 상세' });
 await expect(person.getByRole('link', { name: '검색어 입력' })).toBeVisible();
});
