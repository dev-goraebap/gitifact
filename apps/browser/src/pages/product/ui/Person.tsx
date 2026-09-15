import { Avatar } from '@astryxdesign/core/Avatar';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
/** Deterministic local identicon from the author email; no network lookups. */
export function avatarSource(email:string) {
  let hash=2166136261; for(const c of email) hash=Math.imul(hash^c.charCodeAt(0),16777619);
  const tiles=Array.from({length:15},(_,i)=> ((hash >>> (i%30)) & 1) ? `<rect x="${(i%3)*6+3}" y="${Math.floor(i/3)*6+3}" width="6" height="6"/><rect x="${(4-i%3)*6+3}" y="${Math.floor(i/3)*6+3}" width="6" height="6"/>`:'').join('');
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" fill="hsl(${Math.abs(hash)%360} 25% 85%)"/><g fill="hsl(${Math.abs(hash)%360} 35% 30%)">${tiles}</g></svg>`);
}
export function Person({name,email,avatarOnly=false}: {name:string;email:string;avatarOnly?:boolean}) {
  return <HStack gap={2}><Avatar name={name} src={avatarSource(email)} shape="circle" size="sm"/>{!avatarOnly&&<Text type="supporting">{name}</Text>}</HStack>;
}
