import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/monitoring/scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0, // errors only, no performance tracing
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});

// Lets Sentry tie client-side errors to the route the user was navigating to.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
