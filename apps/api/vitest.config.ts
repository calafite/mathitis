import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const ROOT_DIR = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * Resolves `.js` import specifiers to their `.ts` source files.
 * The codebase uses ESM `.js` extensions (required by `tsc` output),
 * but Vitest must resolve them to the TypeScript sources.
 */
function resolveTsJsPlugin(): Plugin {
  return {
    name: 'resolve-ts-js',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.endsWith('.js') || !importer) return null;
      if (source.startsWith('.')) {
        const tsFile = path.resolve(path.dirname(importer), source.replace(/\.js$/, '.ts'));
        if (existsSync(tsFile)) {
          return tsFile;
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  root: ROOT_DIR,
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@mathitis/api': path.resolve(ROOT_DIR, 'apps/api'),
      '@mathitis/web': path.resolve(ROOT_DIR, 'apps/web'),
      '@mathitis/schemas': path.resolve(ROOT_DIR, 'packages/schemas'),
      '@mathitis/tsconfig': path.resolve(ROOT_DIR, 'packages/config'),
      '@mathitis/utils': path.resolve(ROOT_DIR, 'packages/utils'),
    },
  },
  plugins: [tsconfigPaths(), resolveTsJsPlugin()],
  test: {
    environment: 'node',
    include: ['apps/api/tests/**/*.test.ts'],
    globals: true,
  },
});