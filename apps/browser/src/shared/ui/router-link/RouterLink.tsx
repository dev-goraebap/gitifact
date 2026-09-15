import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';

/** Astryx link swap: an `href` such as `/contributors?author=x` becomes an in-app route change instead of a full reload. */
export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string; children?: ReactNode }>(
  function RouterLink({ href = '', children, onClick, ...rest }, ref) {
    const navigate = useNavigate();
    const internal = href.startsWith('/') && rest.target !== '_blank';
    const handle = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (!internal || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const url = new URL(href, 'http://app.local');
      const search: Record<string, string> = {};
      url.searchParams.forEach((value, key) => { search[key] = value; });
      void navigate({ to: url.pathname as '/', search, hash: url.hash.slice(1) });
    };
    return <a ref={ref} href={href} onClick={handle} {...rest}>{children}</a>;
  });
