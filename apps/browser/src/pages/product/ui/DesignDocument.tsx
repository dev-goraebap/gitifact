import type { SpecFeature } from '@gitifact/contracts';
import { DocumentBody } from '../../../shared/ui/document';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/VStack';
import { t } from '../../../shared/i18n';

export function DesignDocument({design, features}: {design: NonNullable<SpecFeature['design']>; features: SpecFeature[]}) {
  let fence: {char: string; size: number} | undefined;
  const body = design.body.split('\n').map(line => {
    if (fence) { if (new RegExp(`^ {0,3}${fence.char}{${fence.size},}\\s*$`).test(line)) fence = undefined; return line; }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = {char: open[1]![0]!, size: open[1]!.length}; return line; }
    const ref = /^<!-- (?:gitifact|tryce)-ref: (R-[a-z2-7]{10}(?:, R-[a-z2-7]{10})*) -->$/.exec(line);
    if (!ref) return line;
    return '\n' + t('design.relatedRequirements') + ': ' + ref[1]!.split(', ').map(id => {
      const feature = features.find(f => f.requirements.some(r => r.id === id));
      return feature ? `[${id}](/features/${encodeURIComponent(feature.id)}?selected=${id}&tab=requirements#${id})` : t('design.missingRequirement', { id });
    }).join(', ') + '\n';
  }).join('\n');
  return <VStack gap={4}><Heading level={3}>{design.title}</Heading><DocumentBody headingLevelStart={4}>{body}</DocumentBody></VStack>;
}
