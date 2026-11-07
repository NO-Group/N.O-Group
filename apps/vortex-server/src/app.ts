import express, { json } from 'express';
import { mkdir } from 'node:fs/promises';
import { loadEnv } from './config/env.js';
import { errorMiddleware } from './core/http.js';
import { DriverRegistry } from './core/factory/driver.registry.js';
import { createLogger } from './core/logger.js';
import { vortexStorageGuard, parseRlsRules } from './guards/vortex-storage.guard.js';
import { TransformService } from './media/transform.service.js';
import { createStorageRouter } from './routes/storage.routes.js';
import { MultipartJanitor } from './services/multipart-janitor.js';
import { WebhookService } from './webhooks/webhook.service.js';

export interface BuiltApp {
  app: express.Express;
  janitor: MultipartJanitor;
  registry: DriverRegistry;
}

export async function buildApp(): Promise<BuiltApp> {
  const env = loadEnv();
  const logger = createLogger('vortex', env.authDisabled ? 'debug' : 'info');

  await mkdir(env.dataDir, { recursive: true });
  await mkdir(env.cacheDir, { recursive: true });

  const registry = new DriverRegistry(env, logger);
  const webhooks = new WebhookService({
    secret: env.webhookSecret,
    endpoints: env.webhookEndpoints,
    dataDir: env.dataDir,
    logger,
  });
  const transformer = new TransformService(env.cacheDir, logger);
  const janitor = new MultipartJanitor({
    filePath: `${env.dataDir}/multipart-registry.json`,
    maxAgeHours: env.janitor.maxAgeHours,
    intervalSeconds: env.janitor.intervalSeconds,
    logger,
  });
  await janitor.load();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  /* Permissive CORS for direct API consumers (the dashboard itself talks
     to the engine through a same-origin dev proxy). */
  app.use((req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'access-control-allow-headers',
      'content-type, authorization, x-vortex-admin-key',
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(json({ limit: '2mb' }));

  const guard = vortexStorageGuard({
    disabled: env.authDisabled,
    jwtSecret: env.jwtSecret,
    jwtIssuer: env.jwtIssuer,
    adminKey: env.adminKey,
    rules: parseRlsRules(env.rlsRulesJson, logger),
    logger,
  });

  const router = createStorageRouter({
    env,
    logger,
    registry,
    webhooks,
    transformer,
    janitor,
    startedAt: Date.now(),
  });

  /* Signed local-transfer URLs authenticate themselves — mount the router
     with the guard exempted for exactly that path. */
  app.use('/v1/storage/local-transfer', (req, res, next) => {
    void req;
    void res;
    next();
  });
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/v1/storage/local-transfer')) {
      next();
      return;
    }
    guard(req, res, next);
  });
  app.use(router);
  app.use(errorMiddleware());

  return { app, janitor, registry };
}
