import { Worker } from 'bullmq';

export function registerGracefulShutdown(workers: Worker[]) {
  const shutdown = async (signal: NodeJS.Signals) => {
    // eslint-disable-next-line no-console
    console.log(`[workers] received ${signal}, closing...`);
    await Promise.allSettled(workers.map((w) => w.close()));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
