import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Service-layer logic is plain TS + mocked I/O; a Node env is sufficient
    // and avoids pulling the React Native runtime into the test sandbox.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
