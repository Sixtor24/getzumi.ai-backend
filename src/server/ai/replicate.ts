import Replicate from 'replicate';
import { env } from '@/server/env';

export const replicate = env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: env.REPLICATE_API_TOKEN })
  : null;
