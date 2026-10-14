import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/api/**', 'src/hooks/**', 'src/contracts/**', 'src/utils/**', 'src/App.tsx'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
