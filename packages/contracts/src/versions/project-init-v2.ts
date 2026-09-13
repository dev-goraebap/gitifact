import { z } from 'zod';
import { projectInitV1 } from './project-init-v1.js';
export const projectInitV2 = z.discriminatedUnion('ok', [
  projectInitV1.options[0].extend({ version: z.literal(2), projectFormat: z.literal('workflow-1'), mode: z.enum(['auto', 'approval']) }),
  projectInitV1.options[1].extend({ version: z.literal(2) }),
]);
