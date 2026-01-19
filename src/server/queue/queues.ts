import { Queue } from 'bullmq';
import { redis } from '@/server/redis/connection';

export const videoQueue = new Queue('video', { connection: redis as any });
export const imageQueue = new Queue('image', { connection: redis as any });
