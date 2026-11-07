import fs from 'node:fs';
import path from 'node:path';
import type {
  AwsS3DriverConfig,
  AzureDriverConfig,
  DigitalOceanDriverConfig,
  GcsDriverConfig,
  LocalDiskDriverConfig,
  R2DriverConfig,
  VortexStorageProvider,
} from '../core/types/storage.types';

/* ------------------------------------------------------------------ */
/*  Tiny .env loader (no dependency): KEY=VALUE lines, `#` comments,  */
/*  optional quotes. Never overrides already-exported variables.      */
/* ------------------------------------------------------------------ */
function loadDotEnvFile(cwd: string): void {
  const file = path.join(cwd, '.env');
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(name in process.env)) process.env[name] = value;
  }
}

export interface WebhookEndpointEnv {
  url: string;
  description?: string;
}

export interface VortexEnv {
  port: number;
  dataDir: string;
  cacheDir: string;
  publicBaseUrl: string;
  defaultDriver: VortexStorageProvider;
  authDisabled: boolean;
  jwtSecret: string;
  jwtIssuer: string;
  adminKey: string;
  webhookSecret: string;
  webhookEndpoints: WebhookEndpointEnv[];
  rlsRulesJson?: string;
  janitor: { intervalSeconds: number; maxAgeHours: number };
  providers: {
    cloudflare_r2?: { config: R2DriverConfig; missing: string[] };
    aws_s3?: { config: AwsS3DriverConfig; missing: string[] };
    digitalocean_spaces?: { config: DigitalOceanDriverConfig; missing: string[] };
    gcs?: { config: GcsDriverConfig; missing: string[] };
    azure_blob?: { config: AzureDriverConfig; missing: string[] };
    local_disk: { config: LocalDiskDriverConfig; missing: string[] };
  };
}

const DRIVER_IDS: readonly VortexStorageProvider[] = [
  'cloudflare_r2',
  'aws_s3',
  'digitalocean_spaces',
  'gcs',
  'azure_blob',
  'local_disk',
];

function str(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function int(name: string, fallback: number): number {
  const raw = str(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = str(name);
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function json<T>(name: string): T | undefined {
  const raw = str(name);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Environment variable ${name} contains invalid JSON`);
  }
}

/** Returns the subset of `required` names absent from the environment. */
function missing(required: string[]): string[] {
  return required.filter((name) => !str(name));
}

const DEFAULT_DRIVER = 'local_disk';

export function loadEnv(cwd = process.cwd()): VortexEnv {
  loadDotEnvFile(cwd);
  const dataDir = path.resolve(cwd, str('VORTEX_DATA_DIR') ?? './vortex_data');

  const requested = str('VORTEX_STORAGE_DRIVER') ?? DEFAULT_DRIVER;
  if (!DRIVER_IDS.includes(requested as VortexStorageProvider)) {
    throw new Error(
      `VORTEX_STORAGE_DRIVER must be one of ${DRIVER_IDS.join(', ')} (got "${requested}")`,
    );
  }

  const env: VortexEnv = {
    port: int('PORT', 8787),
    dataDir,
    cacheDir: path.resolve(dataDir, str('VORTEX_CACHE_DIR') ?? './cache'),
    publicBaseUrl: str('VORTEX_PUBLIC_BASE_URL') ?? `http://127.0.0.1:${int('PORT', 8787)}`,
    defaultDriver: requested as VortexStorageProvider,
    authDisabled: bool('VORTEX_AUTH_DISABLED', true),
    jwtSecret: str('VORTEX_JWT_SECRET') ?? 'vortex-dev-jwt-secret',
    jwtIssuer: str('VORTEX_JWT_ISSUER') ?? 'vortex.no-group.org',
    adminKey: str('VORTEX_ADMIN_KEY') ?? 'vortex-dev-admin-key',
    webhookSecret: str('VORTEX_WEBHOOK_SECRET') ?? 'whsec_vortex_dev',
    webhookEndpoints: json<WebhookEndpointEnv[]>('VORTEX_WEBHOOK_ENDPOINTS') ?? [],
    ...(str('VORTEX_RLS_RULES') ? { rlsRulesJson: str('VORTEX_RLS_RULES') } : {}),
    janitor: {
      intervalSeconds: int('VORTEX_MULTIPART_JANITOR_INTERVAL_SECONDS', 15 * 60),
      maxAgeHours: int('VORTEX_MULTIPART_MAX_AGE_HOURS', 24),
    },
    providers: {
      local_disk: {
        config: {
          rootDir: path.resolve(dataDir, 'storage'),
          publicBaseUrl: str('VORTEX_PUBLIC_BASE_URL') ?? `http://127.0.0.1:${int('PORT', 8787)}`,
          signingSecret: str('VORTEX_LOCAL_SIGNING_SECRET') ?? 'vortex-local-transfer-secret',
        },
        missing: [],
      },
    },
  };

  /* ---- cloudflare_r2 ---- */
  {
    const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
    const absent = missing(required);
    if (absent.length < required.length) {
      env.providers.cloudflare_r2 = {
        missing: absent,
        config: {
          accountId: str('R2_ACCOUNT_ID') ?? '',
          accessKeyId: str('R2_ACCESS_KEY_ID') ?? '',
          secretAccessKey: str('R2_SECRET_ACCESS_KEY') ?? '',
          bucket: str('R2_BUCKET') ?? '',
        },
      };
    }
  }

  /* ---- aws_s3 ---- */
  {
    const required = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'];
    const absent = missing(required);
    if (absent.length < required.length) {
      env.providers.aws_s3 = {
        missing: absent,
        config: {
          region: str('AWS_REGION') ?? 'us-east-1',
          accessKeyId: str('AWS_ACCESS_KEY_ID') ?? '',
          secretAccessKey: str('AWS_SECRET_ACCESS_KEY') ?? '',
          bucket: str('AWS_S3_BUCKET') ?? '',
          ...(str('AWS_S3_ENDPOINT') ? { endpoint: str('AWS_S3_ENDPOINT') } : {}),
        },
      };
    }
  }

  /* ---- digitalocean_spaces ---- */
  {
    const required = ['DO_SPACES_REGION', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET'];
    const absent = missing(required);
    if (absent.length < required.length) {
      env.providers.digitalocean_spaces = {
        missing: absent,
        config: {
          region: str('DO_SPACES_REGION') ?? 'fra1',
          accessKeyId: str('DO_SPACES_KEY') ?? '',
          secretAccessKey: str('DO_SPACES_SECRET') ?? '',
          bucket: str('DO_SPACES_BUCKET') ?? '',
          ...(str('DO_SPACES_ENDPOINT') ? { endpoint: str('DO_SPACES_ENDPOINT') } : {}),
        },
      };
    }
  }

  /* ---- gcs (S3 interoperability HMAC keys) ---- */
  {
    const required = ['GCS_HMAC_ACCESS_KEY', 'GCS_HMAC_SECRET', 'GCS_BUCKET'];
    const absent = missing(required);
    if (absent.length < required.length) {
      env.providers.gcs = {
        missing: absent,
        config: {
          accessKeyId: str('GCS_HMAC_ACCESS_KEY') ?? '',
          secretAccessKey: str('GCS_HMAC_SECRET') ?? '',
          bucket: str('GCS_BUCKET') ?? '',
          ...(str('GCS_ENDPOINT') ? { endpoint: str('GCS_ENDPOINT') } : {}),
        },
      };
    }
  }

  /* ---- azure_blob ---- */
  {
    const required = ['AZURE_STORAGE_ACCOUNT', 'AZURE_STORAGE_KEY', 'AZURE_STORAGE_CONTAINER'];
    const connectionString = str('AZURE_STORAGE_CONNECTION_STRING');
    const absent = connectionString ? [] : missing(required);
    if (absent.length < required.length || connectionString) {
      env.providers.azure_blob = {
        missing: absent,
        config: {
          accountName: str('AZURE_STORAGE_ACCOUNT') ?? '',
          accountKey: str('AZURE_STORAGE_KEY') ?? '',
          container: str('AZURE_STORAGE_CONTAINER') ?? '',
          ...(connectionString ? { connectionString } : {}),
        },
      };
    }
  }

  return env;
}
