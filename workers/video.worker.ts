import './_bootstrap';

import { Worker } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { redis } from '@/server/redis/connection';
import { registerGracefulShutdown } from './_shared';
import type { VideoJobPayload } from '@/server/queue/types';

const worker = new Worker<VideoJobPayload>(
  'video',
  async (job) => {
    // Persist job status best-effort (optional if DB not ready yet)
    if (job.data?.workspaceId) {
      try {
        await prisma.job.updateMany({
          where: { queueJobId: job.id ?? undefined },
          data: { status: 'RUNNING' }
        });
      } catch {
        // ignore: DB not configured or record not present yet
      }
    }

    // TODO: call Replicate video model and write outputs to S3
    // For now, simulate a successful run.
    await new Promise((r) => setTimeout(r, 250));

    return {
      ok: true,
      message: 'Video worker stub completed',
      prompt: job.data.prompt
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
console.log('[workers] video worker started');
registerGracefulShutdown([worker]);
