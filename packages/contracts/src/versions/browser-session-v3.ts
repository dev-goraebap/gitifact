import { z } from 'zod';
import { browserSessionV2 } from './browser-session-v2.js';

// The browser no longer checks the registry or carries update state.
export const browserSessionV3 = browserSessionV2.omit({ update: true }).extend({ version: z.literal(3) });
export type BrowserSessionV3 = z.infer<typeof browserSessionV3>;
