import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),

  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),

  REDIS_URL: z.string().min(1),

  S3_AWS_REGION: z.string().min(1),
  S3_AWS_ACCESS_KEY_ID: z.string().optional(),
  S3_AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().min(1),

  REPLICATE_API_TOKEN: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional()
});

export const env = envSchema.parse(process.env);
