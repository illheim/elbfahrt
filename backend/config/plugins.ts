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
          'gender',
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
});

export default config;
