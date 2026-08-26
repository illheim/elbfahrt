/**
 * Ride lifecycles — trigger match notifications (v2.0 Stage 2).
 *
 * When an Angebot is created or (re)activated, kick off the matching service
 * fire-and-forget so posting a ride is never slowed. The service is idempotent
 * (match-notification ledger), so an update that re-fires won't re-email.
 */

import { runMatchingForRide } from '../../matching-service';

declare const strapi: any;

function trigger(result: any): void {
  if (result?.id && result?.status === 'active') {
    void runMatchingForRide(strapi, result.id).catch((err: unknown) =>
      strapi.log.error(`[matching] ride ${result.id} run failed: ${err}`)
    );
  }
}

export default {
  afterCreate(event: any) {
    trigger(event.result);
  },
  afterUpdate(event: any) {
    trigger(event.result);
  },
};
