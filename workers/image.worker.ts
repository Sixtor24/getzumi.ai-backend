import './_bootstrap';

import { Worker } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { redis } from '@/server/redis/connection';
import { registerGracefulShutdown } from './_shared';
import type { ImageJobPayload } from '@/server/queue/types';

const worker = new Worker<ImageJobPayload>(
  'image',
  async (job) => {
    try {
      await prisma.job.updateMany({
        where: { queueJobId: job.id ?? undefined },
        data: { status: 'RUNNING' }
      });
    } catch {
      // ignore
    }

    // TODO: call Replicate image editing model and write outputs to S3
    await new Promise((r) => setTimeout(r, 150));

    return {
      ok: true,
      message: 'Image worker stub completed',
      inputAssetId: job.data.inputAssetId
    };
  },
  { connection: redis as any }
);

worker.on('completed', async (job, result) => {
  try {
    await prisma.job.updateMany({
      where: { queueJobId: job.id ?? undefined },
      data: { status: 'SUCCEEDED', output: result as any }
    });
  } catch {
    // ignore
  }
});

worker.on('failed', async (job, err) => {
  try {
    await prisma.job.updateMany({
      where: { queueJobId: job?.id ?? undefined },
      data: { status: 'FAILED', error: { message: err.message, stack: err.stack } as any }
    });
  } catch {
    // ignore
  }
});

// eslint-disable-next-line no-console
console.log('[workers] image worker started');
registerGracefulShutdown([worker]);
