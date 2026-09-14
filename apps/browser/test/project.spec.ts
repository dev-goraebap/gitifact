import {expect,test} from '@playwright/test';
import {mockApi,specs} from './mock-api';
test('history links to current features and contributors with URL restoration',async({page})=>{
 await mockApi(page);await page.goto('/');await page.getByText('검색어 입력',{exact:true}).click();
 await expect(page.getByRole('complementary',{name:'변경 상세'})).toContainText('사용자가 검색을 요청했습니다.');
 await page.getByRole('link',{name:'현재 기능 명세 보기 →'}).click();
 const detail=page.getByRole('complementary',{name:'기능 명세'});await expect(detail).toContainText('기대 동작:');await page.reload();await expect(detail).toBeVisible();
 await page.getByRole('link',{name:'기여자',exact:true}).click();await page.getByRole('button',{name:'Fixture',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'기여자 상세'})).toContainText('최근 불러온 명세 활동');
 await page.getByRole('link',{name:'이 기여자의 요구사항 이력 →'}).click();await expect(page).toHaveURL(/author=/);
 await page.getByRole('textbox',{name:'검색',exact:true}).fill('없는 항목');await expect(page.getByText('표시할 요구사항 이력이 없습니다.',{exact:false})).toBeVisible();
});
test('reload failure labels previous snapshot and malformed responses are rejected',async({page})=>{
 await mockApi(page);await page.goto('/');await expect(page.getByText('검색어 입력',{exact:true})).toBeVisible();
 await page.route('**/api/v1/specs*',r=>r.abort());await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('이전 조회 자료');
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:{...specs,events:'broken'}}));await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('호환되지');
});
test('mobile dark theme preserves safe Markdown and navigation',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});
 const unsafe=structuredClone(specs);unsafe.features[0]!.requirements[0]!.body='<script>window.bad=true</script>\n\n[bad](javascript:alert(1))\n\n**읽을 내용**';
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:unsafe}));await page.goto('/features?feature=S-abcdefghij&selected=R-abcdefghij');
 const detail=page.getByRole('complementary',{name:'기능 명세'});await expect(detail).toContainText('읽을 내용');await expect(detail.locator('script,a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await detail.getByRole('button',{name:'상세 닫기'}).click();await expect(detail).toHaveCount(0);
 await page.getByRole('button',{name:'탐색 열기',exact:true}).click();await page.getByRole('link',{name:'기여자',exact:true}).click();await expect(page).toHaveURL(/contributors/);
});

test('relationship graph connects repeated requirement IDs without expanding its width',async({page})=>{
 await mockApi(page);const repeated=structuredClone(specs);const older=structuredClone(repeated.events[0]!);older.key='d'.repeat(40)+':R-abcdefghij';older.commit='d'.repeat(40);repeated.events.push(older);
 await page.route('**/api/v1/specs*',r=>r.fulfill({json:repeated}));await page.goto('/');const graph=page.getByRole('img',{name:'같은 요구사항의 변경 관계'});await expect(graph.locator('circle')).toHaveCount(2);await expect(graph.locator('path')).toHaveCount(1);expect((await graph.boundingBox())!.width).toBeLessThanOrEqual(88);
});

test('unconnected history hides graph and mixed history only draws connected nodes', async ({page}) => {
 await mockApi(page);
 await page.goto('/');
 await expect(page.getByText('검색어 입력', {exact:true})).toBeVisible();
 const graph = page.getByRole('img', {name:'같은 요구사항의 변경 관계'});
 await expect(graph).toHaveCount(0);
 const mixed = structuredClone(specs);
 const older = structuredClone(mixed.events[0]!);
 older.key = 'd'.repeat(40) + ':R-abcdefghij';
 const unrelated = {...older, key:'unrelated', id:'R-unrelated'};
 mixed.events.push(unrelated, older);
 await page.route('**/api/v1/specs*', route => route.fulfill({json:mixed}));
 await page.getByRole('button', {name:'새로고침',exact:true}).click();
 await expect(graph.locator('circle')).toHaveCount(2);
 await expect(graph.locator('path')).toHaveCount(1);
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
 await expect(page.getByRole('heading',{name:'표시할 요구사항 이력이 없습니다.'})).toBeVisible();
 await expect(page.locator('img[aria-hidden="true"]').first()).toBeVisible();
 await expect(page.getByRole('status',{name:'프로젝트 불러오는 중'})).toHaveCount(0);
});

test('reading pane keeps avatars and can be resized from the keyboard', async ({page}) => {
 await mockApi(page);await page.goto('/');
 await expect(page.getByRole('columnheader',{name:'요구사항 · 변경 후'})).toBeVisible();
 await page.getByText('검색어 입력',{exact:true}).click();
 const pane=page.getByRole('region',{name:'읽기 패널'});
 await expect(pane.getByRole('heading',{name:'변경 후',exact:true})).toBeVisible();
 await expect(page.locator('tbody img').first()).toBeVisible();
 const width=(await pane.boundingBox())!.width;
 const handle=page.getByRole('separator',{name:'변경 상세 너비 조절'});
 await handle.focus();await handle.press('ArrowLeft');
 await expect.poll(async()=>(await pane.boundingBox())!.width).not.toBe(width);
});
