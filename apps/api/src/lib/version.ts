import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version?: string };

export const API_VERSION = pkg.version ?? '0.0.0';
