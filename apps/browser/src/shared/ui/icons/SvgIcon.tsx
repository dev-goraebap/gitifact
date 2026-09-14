import { createElement } from 'react';
type IconSvgObject = readonly (readonly [string, Readonly<Record<string, string | number>>])[];
export function SvgIcon({data, size}: {data: IconSvgObject; size: number}) {
 return <svg viewBox="0 0 24 24" width={`${size / 16}rem`} height={`${size / 16}rem`} style={{ flexShrink: 0 }} fill="none" aria-hidden="true" focusable="false">{data.map(([tag, attrs], index)=>createElement(tag,{...attrs,key:index}))}</svg>;
}
