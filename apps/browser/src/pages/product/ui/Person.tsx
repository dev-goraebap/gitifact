import { Avatar } from '@astryxdesign/core/Avatar';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import styles from './product.module.css';
/** Deterministic local identicon from the author email; no network lookups. */
export function avatarSource(email:string) {
  let hash=2166136261; for(const c of email) hash=Math.imul(hash^c.charCodeAt(0),16777619);
  const tiles=Array.from({length:15},(_,i)=> ((hash >>> (i%30)) & 1) ? `<rect x="${(i%3)*6+3}" y="${Math.floor(i/3)*6+3}" width="6" height="6"/><rect x="${(4-i%3)*6+3}" y="${Math.floor(i/3)*6+3}" width="6" height="6"/>`:'').join('');
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" fill="hsl(${Math.abs(hash)%360} 25% 85%)"/><g fill="hsl(${Math.abs(hash)%360} 35% 30%)">${tiles}</g></svg>`);
}
/** Route of a contributor's detail page. */
export const contributorHref = (email:string) => '/contributors/' + encodeURIComponent(email);
/** Avatar with an optional name; both open the contributor page. */
export function Person({name,email,avatarOnly=false,size='sm'}: {name:string;email:string;avatarOnly?:boolean;size?:'sm'|'md'|'lg'}) {
  return <HStack gap={2} className={styles.person}><Avatar name={name} src={avatarSource(email)} shape="circle" size={size} href={contributorHref(email)}/>
    {!avatarOnly&&<Link to="/contributors/$email" params={{email}} className={styles.personName}>{name}</Link>}</HStack>;
}
