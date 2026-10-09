import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        '*.config.*',
        'src/app/**/*.tsx',
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/components/**/*.tsx',
        'src/lib/i18n/*.tsx',
      ],
      include: [
        'src/lib/**/*.ts',
        'src/app/api/**/*.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
      perFile: true,
    },
    
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    
pool: 'forks',
poolOptions: {
  forks: {
    singleFork: true,
  },
},
  },
});