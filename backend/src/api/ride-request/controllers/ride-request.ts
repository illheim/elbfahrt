/**
 * Ride-request controller — write-path guards (PLAN.md M3 hardening).
 *
 * A RideRequest is a passenger's public "I need a lift" post. The default
 * controller would let a caller create one under someone else's name or edit
 * anyone's request, so we enforce:
 *
 *   create → caller must be signed in; `passenger` is forced to the caller.
 *   update → caller must own the request; `passenger` can't be reassigned.
 *   delete → caller must own the request.
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { SAFE_USER_FIELDS } from '../../../utils/safe-user';
import {
  GESUCH_CONTACT_ENABLED,
  gesuchContact,
  isApprovedDriver,
} from '../ride-request-rules';

const { ForbiddenError, NotFoundError, UnauthorizedError } = errors;

// Read endpoints REPLACE the client's populate so `passenger` PII can't be
// widened via ?populate.
const READ_POPULATE = { passenger: { fields: [...SAFE_USER_FIELDS] } } as const;

/** Load the request by documentId and assert the caller is its passenger. */
async function assertRequestOwner(strapi: any, ctx: any) {
  const user = ctx.state.user;
  if (!user) throw new UnauthorizedError('You must be signed in.');

  const request = await strapi.documents('api::ride-request.ride-request').findOne({
    documentId: ctx.params.id,
    populate: { passenger: { fields: ['id'] } },
  });
  if (!request) throw new NotFoundError('Ride request not found.');
  if (request.passenger?.id !== user.id) {
    throw new ForbiddenError('You can only modify your own ride requests.');
  }
}

export default factories.createCoreController(
  'api::ride-request.ride-request',
  ({ strapi }) => ({
    async find(ctx) {
      const user = ctx.state.user;
      ctx.query = { ...ctx.query, populate: READ_POPULATE };
      // Overview shows OTHER people's Gesuche; the caller's own live under "Meine
      // Fahrten". Can't filter super.find by the `passenger` relation, so exclude
      // the caller's own by documentId (looked up via the document service).
      if (user) {
        const own = await strapi
          .documents('api::ride-request.ride-request')
          .findMany({ filters: { passenger: { id: user.id } }, fields: ['id'] });
        const ownDocIds = own.map((r: any) => r.documentId).filter(Boolean);
        if (ownDocIds.length > 0) {
          const notOwn = { documentId: { $notIn: ownDocIds } };
          ctx.query.filters = ctx.query.filters
            ? { $and: [ctx.query.filters, notOwn] }
            : notOwn;
        }
      }
      return super.find(ctx);
    },

    async findOne(ctx) {
      ctx.query = { ...ctx.query, populate: READ_POPULATE };
      const response = await super.findOne(ctx);

      // A Gesuch is an invitation to be contacted, but only an approved driver
      // — the person who can actually give the ride — gets the number. The list
      // (find) never carries it; this single-item read reveals it on demand.
      if (
        GESUCH_CONTACT_ENABLED &&
        isApprovedDriver(ctx.state.user) &&
        (response as any)?.data
      ) {
        const full = await strapi
          .documents('api::ride-request.ride-request')
          .findOne({
            documentId: ctx.params.id,
            populate: {
              passenger: {
                fields: [
                  'first_name',
                  'last_name',
                  'mobile',
                  'date_of_birth',
                  'parent_first_name',
                  'parent_last_name',
                  'parent_mobile',
                ],
              },
            },
          });
        const contact = gesuchContact((full as any)?.passenger);
        if (contact) (response as any).data.contact = contact;
      }

      return response;
    },

    async create(ctx) {
      const user = ctx.state.user;
      if (!user) throw new UnauthorizedError('You must be signed in to post a ride request.');

      // User relations can't be set via content-API input ("Invalid key
      // passenger"); validate/sanitize client fields, then attach passenger
      // through the service.
      const data = ctx.request.body?.data ?? {};
      await this.validateInput(data, ctx);
      const sanitized = (await this.sanitizeInput(data, ctx)) as Record<string, unknown>;

      const entity = await strapi.service('api::ride-request.ride-request').create({
        data: { ...sanitized, passenger: user.id },
      });

      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      ctx.status = 201;
      return this.transformResponse(sanitizedEntity);
    },

    async update(ctx) {
      await assertRequestOwner(strapi, ctx);
      if (ctx.request.body?.data) delete ctx.request.body.data.passenger;
      return super.update(ctx);
    },

    async delete(ctx) {
      await assertRequestOwner(strapi, ctx);
      return super.delete(ctx);
    },
  })
);
