import type { Core } from '@strapi/strapi';

/**
 * Plugin config.
 *
 * users-permissions.register.allowedFields:
 *   By default the /api/auth/local/register endpoint only accepts
 *   username, email, password — anything else is rejected with
 *   "Invalid parameters". We extended the User schema with the fields
 *   below (PLAN.md §4), so we have to whitelist them here too. This
 *   is the documented Strapi 5 way; preferable to monkey-patching the
 *   auth controller.
 *
 * email:
 *   SMTP via nodemailer, env-driven. Defaults target the dev Mailpit
 *   mail-catcher (host `mailpit`, port 1025, no auth) so the sign-up /
 *   confirmation flow is testable locally without a real provider. For
 *   prod, set SMTP_HOST/PORT/USERNAME/PASSWORD to the chosen provider
 *   (Mailgun/Postmark/Hetzner — see PLAN M4). The confirmation email itself
 *   is sent by users-permissions once "Enable email confirmation" is on
 *   (admin → Users & Permissions → Advanced).
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: [
          'first_name',
          'last_name',
          'date_of_birth',
          'mobile',
          'postal_code',
          'city',
          'street',
          'house_number',
          'parent_first_name',
          'parent_last_name',
          'parent_mobile',
        ],
      },
    },
  },
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'mailpit'),
        port: env.int('SMTP_PORT', 1025),
        secure: env.bool('SMTP_SECURE', false),
        // Mailpit needs no auth; real providers set SMTP_USERNAME/PASSWORD.
        auth:
          env('SMTP_USERNAME') && env('SMTP_PASSWORD')
            ? { user: env('SMTP_USERNAME'), pass: env('SMTP_PASSWORD') }
            : undefined,
      },
      settings: {
        defaultFrom: env('SMTP_FROM', 'no-reply@elb-fahrt.de'),
        defaultReplyTo: env('SMTP_REPLY_TO', env('SMTP_FROM', 'no-reply@elb-fahrt.de')),
      },
    },
  },

  // Error monitoring → self-hosted Bugsink (Sentry-SDK compatible). Inert
  // unless SENTRY_DSN is set. We deliberately do NOT send PII (no user, no
  // request bodies/cookies/headers), and redact anything email/phone-shaped
  // from strings — important given minors on the platform + our Datenschutz.
  sentry: {
    enabled: !!env('SENTRY_DSN'),
    config: {
      dsn: env('SENTRY_DSN'),
      sendMetadata: true, // method + route only; scrubbed further below
      init: {
        environment: env('NODE_ENV', 'production'),
        sendDefaultPii: false,
        beforeSend: scrubEvent,
      },
    },
  },
});

/** Strip PII from a Sentry event before it leaves the server. */
function scrubEvent(event: Record<string, any>): Record<string, any> {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data; // request body may carry names/addresses
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = redact(event.request.query_string);
    }
  }
  if (typeof event.message === 'string') event.message = redact(event.message);
  return event;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s()/-]{6,}\d/g;
function redact(s: string): string {
  return s.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

export default config;
