import { S3Client } from '@aws-sdk/client-s3';
import { BaseS3Driver } from './base-s3.driver.js';
import type { AwsS3DriverConfig } from '../types/storage.types.js';

/**
 * Amazon Web Services S3 — enterprise compliance tier.
 *
 * Target for regulated workloads, automated DB snapshot retention and
 * corporate security tiers. Region is fully dynamic (us-east-1,
 * eu-west-1, …) and an optional endpoint override supports private
 * VPC gateway endpoints and S3-compatible enterprise appliances.
 */
export class AwsS3Driver extends BaseS3Driver {
  readonly provider = 'aws_s3' as const;

  constructor(config: AwsS3DriverConfig) {
    super({
      bucket: config.bucket,
      client: new S3Client({
        region: config.region,
        ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    });
  }
}
