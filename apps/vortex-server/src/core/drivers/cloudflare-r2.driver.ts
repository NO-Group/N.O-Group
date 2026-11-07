import { S3Client } from '@aws-sdk/client-s3';
import { BaseS3Driver } from './base-s3.driver.js';
import type { R2DriverConfig } from '../types/storage.types.js';

/**
 * Cloudflare R2 — the DEFAULT managed Vortex Cloud engine.
 *
 * Selected for managed instances because R2 bills $0 for egress/bandwidth,
 * which makes media-heavy BaaS workloads economically flat at scale.
 *
 * Endpoint format: https://<account_id>.r2.cloudflarestorage.com
 * Region:          "auto" (R2 is globally anycast; the SDK still requires
 *                  a region string, and "auto" is R2's canonical value).
 */
export class CloudflareR2Driver extends BaseS3Driver {
  readonly provider = 'cloudflare_r2' as const;

  constructor(config: R2DriverConfig) {
    super({
      bucket: config.bucket,
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    });
  }
}
