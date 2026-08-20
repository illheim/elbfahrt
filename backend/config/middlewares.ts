import type { Core } from '@strapi/strapi';

// Which browser origins may call this API. Defaults cover local dev and the
// production frontend; override with a comma-separated CORS_ORIGINS env var
// (e.g. to add a staging domain) without touching code.
const corsOrigins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,https://elb-fahrt.de'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: { origin: corsOrigins },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
