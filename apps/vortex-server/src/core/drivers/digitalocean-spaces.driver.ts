import { S3Client } from '@aws-sdk/client-s3';
import { BaseS3Driver } from './base-s3.driver';
import type { DigitalOceanDriverConfig } from '../types/storage.types';

/**
 * DigitalOcean Spaces — indie developer & staging tier.
 *
 * Cost-effective object storage with a flat bandwidth allowance, ideal
 * for indie projects and staging environments.
 *
 * Endpoint format: https://<region>.digitaloceanspaces.com   (e.g. fra1)
 */
export class DigitalOceanSpacesDriver extends BaseS3Driver {
  readonly provider = 'digitalocean_spaces' as const;

  constructor(config: DigitalOceanDriverConfig) {
    super({
      bucket: config.bucket,
      client: new S3Client({
        region: config.region,
        endpoint: config.endpoint ?? `https://${config.region}.digitaloceanspaces.com`,
        forcePathStyle: false,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    });
  }
}
