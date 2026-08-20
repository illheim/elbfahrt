import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Public URL used to build absolute links (e.g. the email-confirmation link).
  // Empty in dev → Strapi builds http://localhost:1337 from host/port. In prod
  // set PUBLIC_URL=https://api.elb-fahrt.de.
  url: env('PUBLIC_URL', ''),
  app: {
    keys: env.array('APP_KEYS'),
  },
});

export default config;
