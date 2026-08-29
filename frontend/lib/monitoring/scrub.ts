/**
 * PII scrubber for Sentry (self-hosted Bugsink) events. Runs in `beforeSend`
 * on both client and server so no personal data leaves the app: we drop the
 * user, cookies, and headers, strip query strings, and redact anything
 * email/phone-shaped from messages and exception values. Important given minors
 * on the platform and our "keine Dritten" Datenschutz.
 */

import type { ErrorEvent } from '@sentry/nextjs';

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s()/-]{6,}\d/g;

function redact(s: string): string {
  return s.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    event.request.query_string = undefined;
    if (typeof event.request.url === 'string') {
      event.request.url = event.request.url.split('?')[0];
    }
  }
  if (typeof event.message === 'string') event.message = redact(event.message);
  for (const v of event.exception?.values ?? []) {
    if (typeof v.value === 'string') v.value = redact(v.value);
  }
  return event;
}
