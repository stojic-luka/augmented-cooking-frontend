import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';

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

const r = (p: string) => path.resolve(import.meta.dirname, p);
const alias = Object.fromEntries(Object.entries(aliases).map(([key]) => [`@${key}`, r(`./src/${key}`)]));
alias['@'] = r('./src');

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // Co-located *.test.tsx files under routes/ are not routes.
      routeFileIgnorePattern: '\\.test\\.(ts|tsx)$',
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: { alias },
});
