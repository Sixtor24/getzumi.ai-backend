import Stripe from 'stripe';
import { env } from '@/server/env';

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      typescript: true
    })
  : null;
