import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
const destinations = [
  ['/', '브리핑'],
  ['/requirements', '요구사항'],
  ['/decisions', '판단 기록'],
  ['/git', 'Git 상태'],
] as const;
export function BrowserShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  return (
    <AppShell
      height="fill"
      contentPadding={0}
      variant="surface"
      mobileNav={{ breakpoint: 'lg' }}
      sideNav={
        <SideNav
          style={{ width: '15rem' }}
          header={<SideNavHeading heading="tryce" headingHref="/" />}
          footer={
            <VStack padding={4} gap={2}>
              <Text type="supporting">로컬 프로젝트 · 읽기 전용</Text>
              <Text type="supporting" color="secondary">
                변경할 내용은 에이전트와 이야기하세요.
              </Text>
            </VStack>
          }
        >
          <SideNavSection title="WORKSPACE">
            {destinations.map(([to, label]) => (
              <SideNavItem
                key={to}
                label={label}
                href={to}
                isSelected={pathname === to}
                onClick={(event) => {
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.button === 0
                  ) {
                    event.preventDefault();
                    void navigate({ to });
                  }
                }}
              />
            ))}
          </SideNavSection>
          <SideNavSection title="TRYCE">
            <SideNavItem
              label="소개"
              href="/about"
              isSelected={pathname === '/about'}
              onClick={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  void navigate({ to: '/about' });
                }
              }}
            />
          </SideNavSection>
        </SideNav>
      }
    >
      <Outlet />
    </AppShell>
  );
}
