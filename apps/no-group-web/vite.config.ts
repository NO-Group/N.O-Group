import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Secrets that must never carry a VITE_ prefix. Vite inlines every VITE_* variable into the
 * public browser bundle, so a VITE_ secret is a leaked secret. Each entry maps the forbidden
 * client name to the server-only name read by the Pages Functions in ./functions.
 */
const FORBIDDEN_CLIENT_SECRETS: Record<string,string> = {
  VITE_BRAVE_SEARCH_API_KEY: 'BRAVE_SEARCH_API_KEY',
  VITE_OPENWEATHERMAP_API_KEY: 'OPENWEATHERMAP_API_KEY',
  VITE_ALLSPORTS_API_KEY: 'ALLSPORTS_API_KEY',
};

/**
 * Fail the build when a forbidden VITE_ secret is present, and say where it came from. Nothing in
 * this repository defines these names; in practice they come from a local .env* file or from the
 * hosting provider's build environment (Cloudflare Pages → Settings → Variables and Secrets).
 */
function rejectClientSecrets(mode: string) {
  // loadEnv(...,'') returns .env* file values merged with process.env; compare the two to find the origin.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  for (const [clientName, serverName] of Object.entries(FORBIDDEN_CLIENT_SECRETS)) {
    const inProcess = Boolean(process.env[clientName]);
    const inFile = Boolean(fileEnv[clientName]) && !inProcess;
    if (!inProcess && !inFile) continue;
    const source = inFile
      ? `a local .env* file for mode "${mode}" in ${process.cwd()}`
      : 'the build process environment (for Cloudflare Pages: Workers & Pages → your project → Settings → Variables and Secrets, in BOTH the Production and Preview environments)';
    throw Error(
      `Remove ${clientName}. Configure the server-only ${serverName} instead; VITE_ secrets are public.\n` +
      `  Source: ${source}.\n` +
      `  The client never reads this variable; it is only forwarded through /api/* Pages Functions.\n` +
      `  After removing it, rotate the exposed key with the provider: earlier bundles may still contain it.`
    );
  }
}

export default defineConfig(({ mode }) => {
  rejectClientSecrets(mode);
  return {
    plugins: [react()],
    server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy: { '/api': 'http://127.0.0.1:8788' } },
    build: { outDir: 'dist' },
  };
});
