import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/server/env';

export const s3 = new S3Client({
  region: env.S3_AWS_REGION,
  credentials:
    env.S3_AWS_ACCESS_KEY_ID && env.S3_AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.S3_AWS_ACCESS_KEY_ID,
          secretAccessKey: env.S3_AWS_SECRET_ACCESS_KEY
        }
      : undefined
});
