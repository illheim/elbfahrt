/**
 * Routes for the "me" controller.
 *
 * These use DEFAULT authentication (no `auth: false`). That matters: Strapi's
 * core auth service short-circuits on `auth: false` — it calls `next()` before
 * running any strategy, so `ctx.state.user` is never populated even when a
 * valid Bearer token is sent (see @strapi/core services/auth: `if (config ===
 * false) return next()`). With default auth the users-permissions strategy
 * runs, sets `ctx.state.user`, and rejects tokenless requests.
 *
 * Because they're normal content-api routes, the Authenticated role must be
 * granted `me.updateProfile`, `me.listBookings`, `me.deleteAccount` and
 * `me.gesuchMatches` in Settings → Users & Permissions → Roles (Public stays
 * off). The controller still null-checks ctx.state.user as defence-in-depth.
 */

export default {
  routes: [
    {
      method: 'PUT',
      path: '/me/profile',
      handler: 'api::me.me.updateProfile',
    },
    {
      method: 'GET',
      path: '/me/bookings',
      handler: 'api::me.me.listBookings',
    },
    {
      method: 'DELETE',
      path: '/me/account',
      handler: 'api::me.me.deleteAccount',
    },
    {
      method: 'GET',
      path: '/me/requests/:id/matches',
      handler: 'api::me.me.gesuchMatches',
    },
  ],
};
