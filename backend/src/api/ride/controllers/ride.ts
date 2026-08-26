/**
 * Ride controller — write-path guards (PLAN.md M3 hardening).
 *
 * Why this exists: the default core controller lets any request with the
 * "create" permission post a Ride with an arbitrary `driver` relation, and
 * lets anyone with "update"/"delete" touch any ride. That's unacceptable —
 * a ride is an offer of transport, often to a minor, so we enforce:
 *
 *   create → caller must be an APPROVED driver; the `driver` relation is
 *            forced to the authenticated user (any client-supplied value is
 *            ignored). driver_status is set only by the users-permissions
 *            lifecycle hook, never from here.
 *   update → caller must own the ride; the `driver` relation can never be
 *            reassigned.
 *   delete → caller must own the ride.
 *
 * Auth note: these routes use the default core router, so ctx.state.user is
 * populated from the JWT when the Authenticated role has the permission. We
 * still null-check it in case the permission is ever granted to Public.
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { SAFE_USER_FIELDS } from '../../../utils/safe-user';

const { ForbiddenError, NotFoundError, UnauthorizedError } = errors;

// Populate spec the read endpoints impose. We REPLACE the client's populate
// rather than merge it, so a caller can never widen `driver` back to full
// PII (or reach user data through a nested relation like `bookings.passenger`).
// `id` is explicit: Strapi drops the numeric id from a relation when `fields`
// is set, but the client needs it to tell "this is my own ride".
const READ_POPULATE = {
  driver: { fields: ['id', ...SAFE_USER_FIELDS] },
  waypoints: true,
} as const;

/**
 * Load the ride by documentId (Strapi 5 uses documentId in the URL) and
 * assert the authenticated user is its driver. Throws otherwise.
 */
async function assertRideOwner(strapi: any, ctx: any) {
  const user = ctx.state.user;
  if (!user) throw new UnauthorizedError('You must be signed in.');

  const ride = await strapi.documents('api::ride.ride').findOne({
    documentId: ctx.params.id,
    populate: { driver: { fields: ['id'] } },
  });
  if (!ride) throw new NotFoundError('Ride not found.');
  if (ride.driver?.id !== user.id) {
    throw new ForbiddenError('You can only modify your own rides.');
  }
}

export default factories.createCoreController('api::ride.ride', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    ctx.query = { ...ctx.query, populate: READ_POPULATE };

    // Rides to hide from the overview, excluded by documentId (a scalar filter
    // super.find accepts — we can't filter it by the `driver` relation).
    const excludeDocIds: string[] = [];

    // 1) The caller's own rides — they live under "Meine Fahrten".
    if (user) {
      const own = await strapi.documents('api::ride.ride').findMany({
        filters: { driver: { id: user.id } },
        fields: ['id'],
      });
      for (const r of own as any[]) if (r.documentId) excludeDocIds.push(r.documentId);
    }

    // 2) Fully-booked one-off rides. Recurring rides book per date, so they're
    //    never globally "full" — only one-off rides can sell out.
    const oneOff = await strapi.db.query('api::ride.ride').findMany({
      where: { status: 'active', recurrence: 'none' },
      select: ['id', 'documentId', 'seats_total'],
    });
    for (const ride of oneOff) {
      const taken = await strapi.db
        .query('api::booking.booking')
        .count({ where: { ride: ride.id, status: 'confirmed' } });
      if (taken >= ride.seats_total) excludeDocIds.push(ride.documentId);
    }

    if (excludeDocIds.length > 0) {
      const notExcluded = { documentId: { $notIn: excludeDocIds } };
      ctx.query.filters = ctx.query.filters
        ? { $and: [ctx.query.filters, notExcluded] }
        : notExcluded;
    }
    return super.find(ctx);
  },

  async findOne(ctx) {
    ctx.query = { ...ctx.query, populate: READ_POPULATE };
    return super.findOne(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError('You must be signed in to offer a ride.');
    if (user.driver_status !== 'approved') {
      throw new ForbiddenError('Only approved drivers can offer rides.');
    }

    // A relation to a User can't be set through the content-API input — Strapi
    // rejects it in validateInput with "Invalid key driver". So we validate and
    // sanitize the CLIENT fields (no driver), then attach the driver ourselves
    // via the service. This also guarantees the caller can't spoof the driver.
    const data = ctx.request.body?.data ?? {};
    await this.validateInput(data, ctx);
    const sanitized = (await this.sanitizeInput(data, ctx)) as Record<string, unknown>;

    const entity = await strapi.service('api::ride.ride').create({
      data: { ...sanitized, driver: user.id },
    });

    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    ctx.status = 201;
    return this.transformResponse(sanitizedEntity);
  },

  async update(ctx) {
    await assertRideOwner(strapi, ctx);
    // A ride can never be handed to a different driver.
    if (ctx.request.body?.data) delete ctx.request.body.data.driver;
    const result = await super.update(ctx);

    // Cancelling a ride also cancels its outstanding bookings, so passengers
    // see it as cancelled (and the seats free up).
    if (ctx.request.body?.data?.status === 'cancelled') {
      const ride = await strapi.documents('api::ride.ride').findOne({
        documentId: ctx.params.id,
        fields: ['id'],
      });
      if (ride) {
        const bookings = await strapi.db.query('api::booking.booking').findMany({
          where: { ride: (ride as any).id, status: 'confirmed' },
          select: ['id'],
        });
        for (const b of bookings) {
          await strapi.db.query('api::booking.booking').update({
            where: { id: b.id },
            data: { status: 'cancelled_by_driver' },
          });
        }
      }
    }
    return result;
  },

  async delete(ctx) {
    await assertRideOwner(strapi, ctx);
    return super.delete(ctx);
  },
}));
