import { buildApp } from './app.js';
import { createLogger } from './core/logger.js';

const logger = createLogger('vortex:bootstrap');

async function main(): Promise<void> {
  const { app, janitor, registry } = await buildApp();

  const port = Number(process.env['PORT'] ?? 8787);
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info('');
    logger.info('  ▲ VORTEX STORAGE ENGINE · N.O Group · no-group.org');
    logger.info(`  ▲ listening on  0.0.0.0:${port}`);
    logger.info(`  ▲ auth mode     ${process.env['VORTEX_AUTH_DISABLED'] === 'false' ? 'JWT + RLS enforced' : 'DEV BYPASS (set VORTEX_AUTH_DISABLED=false to enforce JWT/RLS)'}`);
    logger.info('');
  });

  // The janitor resolves drivers through the registry per sweep, so cloud
  // credentials are only touched when an orphaned session actually exists.
  janitor.start((provider) => {
    try {
      return registry.driver(provider);
    } catch {
      return undefined; // provider unconfigured this boot — entry still drops
    }
  });

  const shutdown = (signal: string) => {
    logger.info(`received ${signal} — draining`);
    janitor.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error('fatal boot failure', error);
  process.exit(1);
});
