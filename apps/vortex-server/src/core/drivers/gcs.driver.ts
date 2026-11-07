import { S3Client } from '@aws-sdk/client-s3';
import { BaseS3Driver } from './base-s3.driver';
import type { GcsDriverConfig } from '../types/storage.types';

/**
 * Google Cloud Storage — AI/ML & analytics tier.
 *
 * Wired through the GCS S3 Interoperability XML API using developer HMAC
 * keys, keeping one dialect across the engine while datasets remain
 * natively readable by BigQuery and Vertex AI training pipelines.
 *
 * Endpoint: https://storage.googleapis.com (path-style required for
 * the interop API).
 */
export class GoogleCloudStorageDriver extends BaseS3Driver {
  readonly provider = 'gcs' as const;

  constructor(config: GcsDriverConfig) {
    super({
      bucket: config.bucket,
      client: new S3Client({
        region: 'auto',
        endpoint: config.endpoint ?? 'https://storage.googleapis.com',
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    });
  }
}
