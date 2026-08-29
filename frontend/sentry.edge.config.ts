import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/monitoring/scrub';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
