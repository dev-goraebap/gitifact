import { fileURLToPath } from 'node:url';
import { Generator, getConfig } from '@tanstack/router-generator';

const root = fileURLToPath(new URL('../', import.meta.url));
const generator = new Generator({ root, config: getConfig({}, root) });
await generator.run();
