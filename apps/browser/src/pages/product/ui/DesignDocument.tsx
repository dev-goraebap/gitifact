import type { SpecFeature } from '@tryce/contracts';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/VStack';

export function DesignDocument({design, features}: {design: NonNullable<SpecFeature['design']>; features: SpecFeature[]}) {
  let fence: {char: string; size: number} | undefined;
  const body = design.body.split('\n').map(line => {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; return line; }
    const ref = /^<!-- tryce-ref: (R-[a-z2-7]{10}(?:, R-[a-z2-7]{10})*) -->$/.exec(line);
    if (!ref) return line;
    return '\n관련 요구사항: ' + ref[1]!.split(', ').map(id => {
      const feature = features.find(f => f.requirements.some(r => r.id === id));
      return feature ? `[${id}](/features?feature=${encodeURIComponent(feature.id)}&selected=${id}&tab=requirements#${id})` : `${id} (현재 명세에 없음)`;
    }).join(', ') + '\n';
  }).join('\n');
  return <VStack gap={4}><Heading level={3}>{design.title}</Heading><Markdown headingLevelStart={4}>{body}</Markdown></VStack>;
}
