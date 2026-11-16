import { fileURLToPath } from 'node:url';

import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { contentSecurityPolicy } from './web/src/csp.ts';
import { SUPABASE_URL, setting } from './web/src/data/environment.ts';

const page = (name) => fileURLToPath(new URL(`web/${name}`, import.meta.url));

/** Adds the Content-Security-Policy to the built page only; the dev server needs its own scripts. */
function securityPolicy() {
  let policy = '';
  let supabaseUrl = '';
  return {
    name: 'content-security-policy',
    apply: 'build',
    configResolved(config) {
      supabaseUrl = new URL(setting(config.env.VITE_SUPABASE_URL, SUPABASE_URL)).origin;
      policy = contentSecurityPolicy(supabaseUrl);
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: supabaseUrl, crossorigin: '' },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  root: 'web',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Two pages until task R12 merges them: the catalog and the React admin page.
    rolldownOptions: { input: { main: page('index.html'), admin: page('admin.html') } },
  },
  // React Compiler memoizes components, so code has no manual useMemo (decision 0006).
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), securityPolicy()],
});
