import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['src/**/*.test.ts','server/**/*.test.ts','platform/**/*.test.ts'],coverage:{include:['platform/**/*.ts','src/lib/**/*.ts']}}});
