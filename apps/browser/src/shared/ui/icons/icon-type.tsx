import { createElement, type SVGProps } from 'react';
type IconSvgObject = readonly (readonly [string, Readonly<Record<string, string | number>>])[];

/**
 * A hugeicons drawing as the icon component Astryx fields take (`startIcon`): the field passes the size and class it
 * wants, so the drawing takes them instead of a size of its own.
 */
export function iconType(data: IconSvgObject) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>{data.map(([tag, attrs], index) => createElement(tag, { ...attrs, key: index }))}</svg>;
  };
}
