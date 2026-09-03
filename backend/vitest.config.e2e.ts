import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // These suites share one real Postgres database and Phase-1's single
    // "default" tenant (see docs/architecture-proposal.md §3) — running
    // files in parallel lets one file's settings/citrineos/* writes race
    // another's. Each file cleans up after itself, which is enough only if
    // files never interleave.
    fileParallelism: false,
  },
});
