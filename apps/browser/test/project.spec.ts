import {expect,test} from '@playwright/test';
import {mockApi,specs,changeBodies,commitSources,serve,checkoutOf} from './mock-api';
test('history links to current features and contributors with URL restoration',async({page})=>{
 await mockApi(page);await page.goto('/records');await page.getByText('검색어 입력',{exact:true}).click();
 await expect(page.getByRole('article',{name:'결정기록 상세'})).toContainText('사용자가 검색을 요청했습니다.');
 await page.getByRole('link',{name:'현재 기능 명세 보기 →'}).click();
 const detail=page.getByRole('article',{name:'기능 명세'});await expect(detail).toContainText('기대 동작:');await page.reload();await expect(detail).toBeVisible();
 await page.getByRole('link',{name:'참여자',exact:true}).click();await page.getByText('fixture@example.test',{exact:true}).click();
 const person=page.getByRole('article',{name:'참여자 상세'});await expect(person).toContainText('최근 명세 활동');await expect(person).toContainText('검색 기능');
 await page.getByRole('link',{name:'이 참여자의 활동 →'}).click();await expect(page).toHaveURL(/author=/);
 await page.getByRole('textbox',{name:'검색',exact:true}).fill('없는 항목');await expect(page.getByText('표시할 기록이 없습니다.',{exact:false})).toBeVisible();
});
test('reload failure labels previous snapshot and malformed responses are rejected',async({page})=>{
 await mockApi(page);await page.goto('/records');await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
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
 data.events=[base,...Array.from({length:50},(_,i)=>({...base,key:'d'.repeat(40)+':R-'+'abcdefgh'+'abcdefghijklmnopqrstuvwxyz234567'[i>>5]+'abcdefghijklmnopqrstuvwxyz234567'[i&31],id:'R-abcdefgh'+'abcdefghijklmnopqrstuvwxyz234567'[i>>5]+'abcdefghijklmnopqrstuvwxyz234567'[i&31],after:{...base.after!,title:i===49?'이전 검색 요구사항':'이전 변경 '+i},records:[]}))];
 return data;
}
test('load more retains rows, appends the next page and shows completion', async ({page}) => {
 await mockApi(page, longHistory());
 await page.goto('/records');
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
 await page.goto('/records');
 await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'이전 이력 더 보기',exact:true}).click();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 expect(history).toBe(2);
 await page.getByRole('link',{name:'대시보드',exact:true}).click();
 await expect(page.getByRole('article',{name:'대시보드'})).toBeVisible();
 await page.getByRole('link',{name:'결정기록',exact:true}).click();
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
 await page.goto('/records');
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCSS('opacity','1');
 release();
 await expect(page.getByRole('heading',{name:'표시할 기록이 없습니다.'})).toBeVisible();
 await expect(page.locator('img[aria-hidden="true"]').first()).toBeVisible();
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCount(0);
});

test('a record opens on a page of its own with the documents it explains, its commit is one step on, and the list one step back', async ({page}) => {
 await mockApi(page);await page.goto('/records');
 await expect(page.getByRole('list',{name:'결정기록 목록'}).locator('img').first()).toBeVisible();
 // The list names the record over its documents; its sections are read on its page.
 await expect(page.getByRole('list',{name:'결정기록 목록'})).not.toContainText('맥락');
 await page.getByRole('link',{name:'사용자가 검색을 요청했습니다.'}).click();
 await expect(page).toHaveURL(/\/records\/H-aaaaaaaaaa$/);
 const record=page.getByRole('article',{name:'결정기록 상세'});
 await expect(record.getByRole('heading',{level:1})).toHaveText('사용자가 검색을 요청했습니다.');
 await expect(record.getByRole('heading',{name:'맥락'})).toBeVisible();
 // One document: it starts open with its text.
 await expect(record.getByRole('region',{name:'이 결정으로 바뀐 문서'})).toContainText('검색어 입력');
 // The commit is a line of the record's head: its message and hash both lead to its page.
 await expect(record.getByRole('link',{name:specs.events[0]!.message})).toHaveAttribute('href',new RegExp('/records/commits/'+specs.head+'$'));
 await record.getByRole('link',{name:specs.head!.slice(0,12)}).first().click();
 await expect(page).toHaveURL(new RegExp('/records/commits/'+ specs.head + '$'));
 const article=page.getByRole('article',{name:'커밋 상세'});
 await expect(article.getByRole('heading',{level:1})).toHaveText(specs.events[0]!.message);
 // A commit with records opens on them; a link that names a document opens its documents at that section.
 await expect(article.getByRole('tab',{name:/결정기록/})).toHaveAttribute('aria-selected','true');
 await expect(article.getByRole('link',{name:'사용자가 검색을 요청했습니다.'})).toHaveAttribute('href',/\/records\/H-aaaaaaaaaa$/);
 await page.goto('/records/commits/'+ specs.head + '#R-abcdefghij');
 // The named document is the one read beside the list, and the list marks it.
 await expect(article.getByRole('tab',{name:/문서/})).toHaveAttribute('aria-selected','true');
 await expect(article.getByRole('region',{name:'검색어 입력'})).toBeVisible();
 await expect(article.getByRole('navigation',{name:'바뀐 문서'}).locator('[aria-current=true]')).toContainText('검색어 입력');
 await page.getByRole('navigation',{name:'이동 경로'}).getByRole('link',{name:'결정기록',exact:true}).click();
 await expect(page).toHaveURL(/\/records$/);
});

test('history rows preview change reasons and mark missing ones', async ({page}) => {
 await mockApi(page);
 const event=specs.events[0]!;
 const data={...structuredClone(specs),events:[
  {...event,key:specs.head+':R-bbbbbbbbbb',id:'R-bbbbbbbbbb',types:['modified' as const],before:event.after,after:{...event.after!,id:'R-bbbbbbbbbb',title:'검색 결과 정렬'},records:[{id:'H-1111111111',title:'정렬을 요청했습니다.',sections:[{key:'context' as const,body:'정렬을 요청했습니다.'}]},{id:'H-2222222222',title:'응답 순서 고정',sections:[{key:'context' as const,body:'같은 검색에 다른 순서가 나오면 헷갈린다.'},{key:'decision' as const,body:'응답 순서를 고정합니다.'}]}]},
  {...event,key:specs.head+':R-cccccccccc',id:'R-cccccccccc',types:['deleted' as const],before:{...event.after!,id:'R-cccccccccc',title:'이유 없는 변경'},after:null,records:[]},
 ]};
 // The rows carry names only; the commit page reads the text on both sides.
 // Twelve lines where only the sixth changes one word, so the far unchanged lines fold and the word is marked.
 const sorted=(order:string)=>[...[1,2,3,4,5].map(n=>`${n}번째 줄입니다.`),`검색 결과를 ${order} 정렬합니다.`,...[7,8,9,10,11,12].map(n=>`${n}번째 줄입니다.`)].join('\n');
 changeBodies[specs.head+':R-bbbbbbbbbb']={before:{...event.after!,id:'R-bbbbbbbbbb',title:'검색 정렬',body:sorted('날짜순으로')},after:{...event.after!,id:'R-bbbbbbbbbb',title:'검색 결과 정렬',body:sorted('이름순으로')}};
 changeBodies[specs.head+':R-cccccccccc']={before:{...event.after!,id:'R-cccccccccc',title:'이유 없는 변경',body:'본문만 있습니다.'},after:null};
 await serve(page, data);
 await page.goto('/records');
 // Both changes ride on one commit, so the timeline has one entry; each record heads the documents it explains, and a
 // change no record explains is marked.
 const commits=page.getByRole('list',{name:'결정기록 목록'}).locator('> li');await expect(commits).toHaveCount(1);
 await expect(commits.first()).toContainText('문서 2건');
 // Two records each list what they changed; the change no record explains is listed as the commit's.
 const reasons=commits.first().getByRole('list',{name:'이 결정으로 바뀐 문서'});await expect(reasons).toHaveCount(2);
 await expect(commits.first().getByRole('list',{name:'바뀐 문서',exact:true})).toContainText('이유 없는 변경');
 await expect(commits.first().getByRole('link',{name:'응답 순서 고정'})).toHaveAttribute('href',new RegExp('/records/H-2222222222$'));
 // A record shows the first line of its decision; its context is read on its page.
 await expect(commits.first()).not.toContainText('같은 검색에 다른 순서가 나오면 헷갈린다.');
 await expect(commits.first()).toContainText('정렬을 요청했습니다.');
 await expect(commits.first()).toContainText('응답 순서를 고정합니다.');
 await expect(commits.first()).not.toContainText('정렬 본문입니다.');
 await expect(commits.first()).toContainText('결정기록 없이 바뀐 문서');
 await reasons.nth(0).getByRole('link',{name:'검색 결과 정렬'}).click();
 // The document opens on the record's page, where a record of one document starts open.
 const pane=page.getByRole('article',{name:'결정기록 상세'});
 await expect(pane.getByRole('heading',{name:'맥락'})).toBeVisible();
 // The title changed as a field; the body as source lines, one removed and one added, the changed word marked.
 await expect(pane.getByRole('region',{name:'바뀐 항목'})).toContainText('title');
 await expect(pane.getByRole('region',{name:'바뀐 항목'}).locator('del')).toHaveText('검색 정렬');
 const body=pane.getByRole('table',{name:'본문 변경'});
 await expect(body.locator('mark')).toHaveText(['날짜순으로','이름순으로']);
 // Unchanged lines away from the change fold: two at the top and three at the bottom, with three kept beside it.
 await expect(body.getByRole('button',{name:'바뀌지 않은 2줄 펼치기'})).toBeVisible();
 await expect(body.getByRole('button',{name:'바뀌지 않은 3줄 펼치기'})).toBeVisible();
 await expect(body).not.toContainText('1번째 줄입니다.');
 await body.getByRole('button',{name:'바뀌지 않은 2줄 펼치기'}).click();await expect(body).toContainText('1번째 줄입니다.');
 // A desktop width puts the two versions of the line on one row; a narrow one puts them under each other.
 await expect(body.locator('tr',{hasText:'날짜순으로'})).toContainText('이름순으로');
 await page.setViewportSize({width:820,height:900});
 await expect(body.locator('tr',{hasText:'날짜순으로'})).not.toContainText('이름순으로');
});

test('the commit page reads its code as files down the side and the chosen file\'s diff beside them', async ({page}) => {
 await mockApi(page);
 const event=specs.events[0]!;
 commitSources[event.commit]=[
  {file:{path:'src/search.ts',status:'modified',additions:1,deletions:1},before:'export const order = "date";\n',after:'export const order = "name";\n'},
  {file:{path:'assets/logo.png',status:'added',additions:null,deletions:null},before:null,after:null,binary:true},
 ];
 await serve(page, specs);
 await page.goto('/records/commits/'+event.commit);
 const article=page.getByRole('article',{name:'커밋 상세'});
 await article.getByRole('tab',{name:/코드 2/}).click();
 await expect(page).toHaveURL(/\?tab=code$/);
 const files=article.getByRole('navigation',{name:'같은 커밋의 소스 변경'});
 await expect(files).toContainText('파일 2개');
 await expect(files).toContainText('+1');
 // The first file opens when none is named: its lines compare with the changed word marked.
 const panel=article.getByRole('tabpanel',{name:'같은 커밋의 소스 변경'});
 await expect(panel.getByRole('table',{name:'src/search.ts 변경'}).locator('mark')).toHaveText(['date','name']);
 await files.getByRole('link',{name:/logo\.png/}).click();
 await expect(page).toHaveURL(/file=assets%2Flogo\.png$/);
 await expect(panel).toContainText('텍스트가 아닌 파일이라');
 delete commitSources[event.commit];
});

test('a reason is written once over the records it explains, and each day is marked once', async ({page}) => {
 await mockApi(page);
 const event=specs.events[0]!;
 const shared='한 번만 적히는 이유입니다.';
 const record=(commit:string,date:string,id:string,title:string,reason:string)=>
  ({...event,commit,date,key:commit+':'+id,id,after:{...event.after!,id,title},// 0.7 stored a reason once per document, so the same text comes under a different ID for each.
  records:[{id:reason===shared?'H-a'+id.slice(2):'H-bbbbbbbbbb',title:reason===shared?'공유된 기록':'다른 날의 기록',sections:[{key:'context' as const,body:reason}]}]});
 const older='d'.repeat(40);
 const data={...structuredClone(specs),events:[
  record(specs.head!,'2026-09-14T00:00:00Z','R-1111111111','첫 기록',shared),
  record(specs.head!,'2026-09-14T00:00:00Z','R-2222222222','둘째 기록',shared),
  record(specs.head!,'2026-09-14T00:00:00Z','R-3333333333','셋째 기록',shared),
  record(older,'2026-09-12T00:00:00Z','R-4444444444','앞선 기록','다른 날의 이유입니다.'),
 ]};
 await serve(page, data);
 await page.goto('/records');
 const commits=page.getByRole('list',{name:'결정기록 목록'}).locator('> li');await expect(commits).toHaveCount(2);
 // The same sentence is stored against all three records. Printing it per record is what made the timeline unreadable.
 await expect(page.getByText(shared,{exact:true})).toHaveCount(1);
 await expect(commits.first().getByRole('list',{name:'이 결정으로 바뀐 문서'}).getByRole('listitem')).toHaveCount(3);
 await expect(commits.first()).toContainText('문서 3건');
 // Each calendar day is named where it turns over, and a commit alone on its day carries no count.
 await expect(commits.first()).toContainText('2026년 9월 14일');
 await expect(commits.nth(1)).toContainText('2026년 9월 12일');
 await expect(commits.nth(1)).not.toContainText('문서 1건');
 // The record page, opened by any of those IDs, shows the reason once over all three documents.
 await commits.first().getByRole('link',{name:'공유된 기록'}).click();
 const detail=page.getByRole('article',{name:'결정기록 상세'});
 for (const title of ['첫 기록','둘째 기록','셋째 기록']) await expect(detail.getByText(title,{exact:true}).first()).toBeVisible();
 await expect(detail.getByRole('region',{name:'같은 커밋의 다른 기록'})).toHaveCount(0);
});

test('a list row carries no body; the commit is read once and shows the text of its documents', async ({page}) => {
 await mockApi(page);
 let reads = 0;
 await page.route(url => url.pathname === '/api/v1/commit', async route => { reads++;
  const event = specs.events[0]!;
  await route.fulfill({json:{contract:'browser-commit',version:3,sessionId:specs.sessionId,commit:event.commit,author:event.author,email:event.email,committer:event.committer,date:event.date,message:event.message,
   changes:[{event,before:null,after:{id:'R-abcdefghij',kind:'requirement',title:'검색어 입력',description:'검색어 입력',body:'본문은 **열 때** 읽습니다.',specId:'S-abcdefghij',path:'.gitifact/spec/search/requirements/r-abcdefghij.md'}}]}}); });
 await page.goto('/records');
 await expect(page.getByRole('list',{name:'결정기록 목록'})).not.toContainText('본문은 열 때 읽습니다.');
 await page.getByText('검색어 입력',{exact:true}).click();
 const article = page.getByRole('article',{name:'결정기록 상세'});
 await expect(article).toContainText('본문은 열 때 읽습니다.');
 await expect(article).toContainText('사용자가 검색을 요청했습니다.');
 // The commit page reads the same commit, and coming back does not ask again: a commit never changes.
 await article.getByRole('link',{name:specs.events[0]!.message}).click();
 await page.getByRole('article',{name:'커밋 상세'}).getByRole('tab',{name:/문서/}).click();
 await expect(page.getByRole('article',{name:'커밋 상세'})).toContainText('본문은 열 때 읽습니다.');
 // Back past the tab and the commit page to the record.
 await page.goBack(); await page.goBack();
 await expect(page.getByRole('article',{name:'결정기록 상세'})).toContainText('본문은 열 때 읽습니다.');
 expect(reads).toBe(1);
});

test('a commit that cannot be read says so on its page instead of leaving it blank', async ({page}) => {
 await mockApi(page);
 await page.route(url => url.pathname === '/api/v1/commit', route => route.fulfill({status:503,json:{contract:'browser-http-error',version:1,error:{code:'INTERNAL_ERROR',message:'읽기 실패'}}}));
 await page.goto('/records/commits/'+ specs.head);
 await expect(page.getByRole('alert')).toContainText('읽기 실패');
});

test('a filter and a search word find changes that were never loaded, with the whole count', async ({page}) => {
 await mockApi(page, longHistory());
 await page.goto('/records');
 await expect(page.getByText('전체 51건 중 50건을 보고 있습니다.',{exact:false})).toBeVisible();
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toHaveCount(0);
 // The fifty-first change is not on screen, and the word still finds it: the server searches all of history.
 await page.getByRole('textbox',{name:'검색',exact:true}).fill('이전 검색');
 await expect(page.getByText('이전 검색 요구사항',{exact:true})).toBeVisible();
 await expect(page.getByText('전체 1건 중 1건을 보고 있습니다.',{exact:false})).toBeVisible();
});

test('a link to any commit opens its page, whether the list loaded it or not', async ({page}) => {
 const data = longHistory(); const last = data.events.at(-1)!;
 changeBodies[last.key] = { before: null, after: { ...last.after!, body: '오래된 변경의 본문' } };
 await mockApi(page, data);
 await page.goto('/records/commits/'+ last.commit + '?tab=documents#' + last.id);
 const article = page.getByRole('article', { name: '커밋 상세' });
 await expect(article).toContainText('오래된 변경의 본문');
 await expect(article).toContainText('이전 검색 요구사항');
});

test('the overview counts all of history, and a contributor page asks for that person\'s changes', async ({page}) => {
 await mockApi(page, longHistory());
 await page.goto('/dashboard');
 await expect(page.getByText('전체 활동 51건').first()).toBeVisible();
 await page.goto('/contributors/' + encodeURIComponent('fixture@example.test'));
 const person = page.getByRole('article', { name: '참여자 상세' });
 await expect(person.getByRole('link', { name: '검색어 입력' })).toBeVisible();
});

test('a record reads as its feature and then the document, and only the document is a link', async ({page}) => {
 await mockApi(page);await page.goto('/records');
 const row=page.getByRole('list',{name:'이 결정으로 바뀐 문서'}).getByRole('listitem').first();
 const feature=specs.features.find(f=>f.id===specs.events[0]!.after!.specId)!;
 await expect(row).toContainText(new RegExp(feature.title+'\s*·\s*검색어 입력'));
 // The feature is context, not a way out; the document opens its part of the record's page.
 await expect(row.getByRole('link')).toHaveText(['검색어 입력']);
 await row.getByRole('link').click();
 await expect(page).toHaveURL(/\/records\/H-aaaaaaaaaa#R-abcdefghij$/);
});

test('a list row opens its commit from the hash and message, and a narrow screen picks files from one selector', async ({page}) => {
 await mockApi(page);
 const event=specs.events[0]!;
 await page.goto('/records');
 await page.getByRole('list',{name:'결정기록 목록'}).getByRole('link',{name:new RegExp(event.commit.slice(0,7))}).first().click();
 await expect(page).toHaveURL(new RegExp('/records/commits/'+event.commit+'$'));
 commitSources[event.commit]=[
  {file:{path:'src/search.ts',status:'modified',additions:1,deletions:1},before:'a\n',after:'b\n'},
  {file:{path:'src/order.ts',status:'added',additions:1,deletions:0},before:null,after:'c\n'},
 ];
 await serve(page, specs);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/records/commits/'+event.commit+'?tab=code');
 const article=page.getByRole('article',{name:'커밋 상세'});
 // The list of files gives way to a selector over the diff.
 await expect(article.getByRole('navigation',{name:'같은 커밋의 소스 변경'})).toBeHidden();
 await article.getByRole('combobox',{name:'같은 커밋의 소스 변경'}).click();
 await page.getByRole('option',{name:/order\.ts/}).click();
 await expect(page).toHaveURL(/file=src%2Forder\.ts$/);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 delete commitSources[event.commit];
});
