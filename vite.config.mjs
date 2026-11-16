import { defineConfig } from 'vite';

import { contentSecurityPolicy } from './web/src/csp.ts';
import { SUPABASE_URL, setting } from './web/src/data/environment.ts';

/** Adds the Content-Security-Policy to the built page only; the dev server needs its own scripts. */
function securityPolicy() {
  let policy = '';
  return {
    name: 'content-security-policy',
    apply: 'build',
    configResolved(config) {
      policy = contentSecurityPolicy(setting(config.env.VITE_SUPABASE_URL, SUPABASE_URL));
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  root: 'web',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [securityPolicy()],
});
