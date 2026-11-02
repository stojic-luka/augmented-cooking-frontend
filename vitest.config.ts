import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const r = (p: string) => path.resolve(import.meta.dirname, p);

// Mirrors the alias map in vite.config.ts — keep the two in sync.
const aliases = {
  api: 'api',
  assets: 'assets',
  components: 'components',
  config: 'config',
  features: 'features',
  hooks: 'hooks',
  lib: 'lib',
  providers: 'providers',
  routes: 'routes',
  styles: 'styles',
} as const;

const alias = Object.fromEntries(Object.entries(aliases).map(([key]) => [`@${key}`, r(`./src/${key}`)]));
alias['@'] = r('./src');

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    restoreMocks: true,
    env: {
      // Client config (src/config/client) Zod-parses import.meta.env at module
      // load — tests get an isolated fake backend + fake Supabase project.
      // Page origin, API, and Supabase share one origin so axios's XHR in
      // jsdom never triggers a CORS preflight.
      VITE_API_URL: 'http://augmented.test',
      VITE_SUPABASE_URL: 'http://augmented.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
    },
    environmentOptions: {
      jsdom: { url: 'http://augmented.test' },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/features/**/services/**', 'src/features/**/utils/**', 'src/features/**/lib/**', 'src/api/**', 'src/utils/**', 'src/features/**/store/**'],
      exclude: ['src/test/**', '**/*.test.*', '**/*.schema.ts', '**/index.ts', '**/routeTree.gen.ts'],
    },
  },
});
