// Component tests (.tsx). Node runs .ts tests directly but not JSX, so these run in Vitest.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['web/src/**/*-test.tsx', 'web/tests/**/*-test.tsx'],
    environment: 'jsdom',
    restoreMocks: true,
  },
});
