import { factories } from '@strapi/strapi';

// No public endpoints — the ledger is written only by the server-side matching
// service. `only: []` registers the router with zero routes.
export default factories.createCoreRouter(
  'api::match-notification.match-notification',
  { only: [] }
);
