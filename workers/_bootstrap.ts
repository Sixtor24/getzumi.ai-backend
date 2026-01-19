import dotenv from 'dotenv';

// Next.js loads `.env.local` automatically, but Node workers need explicit loading.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Ensure this process fails fast on unhandled rejections.
process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error('UnhandledRejection', err);
  process.exitCode = 1;
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('UncaughtException', err);
  process.exitCode = 1;
});
