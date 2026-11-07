import type { VortexEnv } from '../../config/env.js';
import { HttpError } from '../http.js';
import type { Logger } from '../logger.js';
import { AzureBlobDriver } from '../drivers/azure-blob.driver.js';
import { AwsS3Driver } from '../drivers/aws-s3.driver.js';
import { CloudflareR2Driver } from '../drivers/cloudflare-r2.driver.js';
import { DigitalOceanSpacesDriver } from '../drivers/digitalocean-spaces.driver.js';
import { GoogleCloudStorageDriver } from '../drivers/gcs.driver.js';
import { LocalDiskDriver } from '../drivers/local-disk.driver.js';
import type {
  IVortexStorageDriver,
  ProviderDescriptor,
  VortexStorageProvider,
} from '../types/storage.types.js';
import { VORTEX_PROVIDERS } from '../types/storage.types.js';

interface ProviderMeta {
  label: string;
  tier: string;
  tagline: string;
  description: string;
  endpointHint: string;
  accentStop: 1 | 2 | 3 | 4 | 5 | 6;
  requiredEnv: string[];
}

/**
 * The official Vortex provider catalogue. `accentStop` maps each provider
 * onto the N.O Group 6-stop spectrum gradient for dashboard rendering.
 */
export const PROVIDER_META: Record<VortexStorageProvider, ProviderMeta> = {
  cloudflare_r2: {
    label: 'Cloudflare R2',
    tier: 'DEFAULT · MANAGED',
    tagline: '$0 egress managed cloud',
    description:
      'Primary engine for managed Vortex Cloud instances. Zero egress/bandwidth transfer cost, globally anycast S3-compatible API.',
    endpointHint: 'https://<account_id>.r2.cloudflarestorage.com',
    accentStop: 1,
    requiredEnv: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
  },
  aws_s3: {
    label: 'Amazon S3',
    tier: 'ENTERPRISE',
    tagline: 'Compliance & snapshot retention',
    description:
      'Enterprise compliance tier: automated DB snapshot retention, corporate security programs, dynamic region parsing.',
    endpointHint: 'https://s3.<region>.amazonaws.com',
    accentStop: 4,
    requiredEnv: ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'],
  },
  digitalocean_spaces: {
    label: 'DigitalOcean Spaces',
    tier: 'INDIE',
    tagline: 'Staging & indie projects',
    description:
      'Cost-effective flat-bandwidth object storage tuned for indie developer projects and staging environments.',
    endpointHint: 'https://<region>.digitaloceanspaces.com',
    accentStop: 5,
    requiredEnv: ['DO_SPACES_REGION', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET'],
  },
  gcs: {
    label: 'Google Cloud Storage',
    tier: 'AI/ML',
    tagline: 'BigQuery & training pipelines',
    description:
      'AI/ML training corpus and BigQuery analytical processing via the GCS S3 Interoperability XML API with HMAC keys.',
    endpointHint: 'https://storage.googleapis.com',
    accentStop: 3,
    requiredEnv: ['GCS_HMAC_ACCESS_KEY', 'GCS_HMAC_SECRET', 'GCS_BUCKET'],
  },
  azure_blob: {
    label: 'Azure Blob Storage',
    tier: 'CORPORATE IT',
    tagline: 'B2B SaaS & enterprise IT',
    description:
      'Corporate enterprise IT compliance and B2B SaaS integrations through the native Block Blob API with SAS presigns.',
    endpointHint: 'https://<account>.blob.core.windows.net',
    accentStop: 2,
    requiredEnv: ['AZURE_STORAGE_ACCOUNT', 'AZURE_STORAGE_KEY', 'AZURE_STORAGE_CONTAINER'],
  },
  local_disk: {
    label: 'Local Disk',
    tier: 'DEV / DOCKER',
    tagline: 'Zero-cost persistent volume',
    description:
      'Zero-cost local development, offline testing and Docker single-node deployments on the ./vortex_data/storage volume.',
    endpointHint: './vortex_data/storage/',
    accentStop: 6,
    requiredEnv: [],
  },
};

/** Construct a concrete driver for `provider` from its detected env config. */
function buildDriver(
  provider: VortexStorageProvider,
  env: VortexEnv,
): IVortexStorageDriver {
  switch (provider) {
    case 'cloudflare_r2': {
      const entry = env.providers.cloudflare_r2;
      if (!entry || entry.missing.length > 0) throw missingError(provider, entry?.missing);
      return new CloudflareR2Driver(entry.config);
    }
    case 'aws_s3': {
      const entry = env.providers.aws_s3;
      if (!entry || entry.missing.length > 0) throw missingError(provider, entry?.missing);
      return new AwsS3Driver(entry.config);
    }
    case 'digitalocean_spaces': {
      const entry = env.providers.digitalocean_spaces;
      if (!entry || entry.missing.length > 0) throw missingError(provider, entry?.missing);
      return new DigitalOceanSpacesDriver(entry.config);
    }
    case 'gcs': {
      const entry = env.providers.gcs;
      if (!entry || entry.missing.length > 0) throw missingError(provider, entry?.missing);
      return new GoogleCloudStorageDriver(entry.config);
    }
    case 'azure_blob': {
      const entry = env.providers.azure_blob;
      if (!entry || entry.missing.length > 0) throw missingError(provider, entry?.missing);
      return new AzureBlobDriver(entry.config);
    }
    case 'local_disk':
      return new LocalDiskDriver(env.providers.local_disk.config);
  }
}

function missingError(provider: string, missing: string[] | undefined): HttpError {
  return HttpError.badRequest(
    `Provider "${provider}" is not configured`,
    { missingEnv: missing ?? ['<entire provider block absent>'] },
  );
}

/**
 * Owns the lazily-instantiated driver pool and the runtime "active"
 * provider pointer flipped by the dashboard Multi-Cloud Selector.
 */
export class DriverRegistry {
  private readonly drivers = new Map<VortexStorageProvider, IVortexStorageDriver>();
  private activeProvider: VortexStorageProvider;

  constructor(
    private readonly env: VortexEnv,
    private readonly logger: Logger,
  ) {
    this.activeProvider = env.defaultDriver;
  }

  isConfigured(provider: VortexStorageProvider): boolean {
    if (provider === 'local_disk') return true;
    const entry = this.env.providers[provider];
    return !!entry && entry.missing.length === 0;
  }

  missingEnv(provider: VortexStorageProvider): string[] {
    return this.env.providers[provider]?.missing ?? PROVIDER_META[provider].requiredEnv;
  }

  get active(): VortexStorageProvider {
    return this.activeProvider;
  }

  setActive(provider: VortexStorageProvider): void {
    if (!VORTEX_PROVIDERS.includes(provider)) {
      throw HttpError.badRequest(`Unknown storage provider "${provider}"`, {
        valid: VORTEX_PROVIDERS,
      });
    }
    if (!this.isConfigured(provider)) {
      throw missingError(provider, this.missingEnv(provider));
    }
    this.activeProvider = provider;
    this.logger.info(`Active storage engine switched → ${provider}`);
  }

  /** Resolve a driver (defaulting to the active provider), instantiating lazily. */
  driver(provider?: VortexStorageProvider): IVortexStorageDriver {
    const id = provider ?? this.activeProvider;
    const existing = this.drivers.get(id);
    if (existing) return existing;
    const built = buildDriver(id, this.env);
    this.drivers.set(id, built);
    this.logger.info(`Instantiated storage driver: ${id}`);
    return built;
  }

  descriptors(): ProviderDescriptor[] {
    return VORTEX_PROVIDERS.map((id) => {
      const meta = PROVIDER_META[id];
      return {
        id,
        label: meta.label,
        tier: meta.tier,
        tagline: meta.tagline,
        description: meta.description,
        endpointHint: meta.endpointHint,
        accentStop: meta.accentStop,
        configured: this.isConfigured(id),
        active: this.activeProvider === id,
        missingEnv: this.missingEnv(id),
      };
    });
  }

  /** Drivers currently instantiated — used by the multipart janitor. */
  instantiated(): ReadonlyMap<VortexStorageProvider, IVortexStorageDriver> {
    return this.drivers;
  }
}
