import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import styles from '../styles/shell.module.css';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: () => (
    <section>
      <h1>페이지를 찾을 수 없습니다</h1>
      <Link to="/">처음으로</Link>
    </section>
  ),
});

function RootLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>tryce</Link>
        <nav aria-label="주 메뉴">
          <Link to="/about">소개</Link>
        </nav>
      </header>
      <main className={styles.content}><Outlet /></main>
    </div>
  );
}
