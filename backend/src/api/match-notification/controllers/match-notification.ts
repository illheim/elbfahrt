import { factories } from '@strapi/strapi';

// Internal-only content type; no routes are exposed (see routes file).
export default factories.createCoreController(
  'api::match-notification.match-notification'
);
