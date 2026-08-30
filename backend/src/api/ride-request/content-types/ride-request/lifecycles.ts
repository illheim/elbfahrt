/**
 * Ride-request lifecycles — trigger the REVERSE match (beta bug B2).
 *
 * When a Gesuch is created or (re)activated, match it against existing active
 * rides and email the rider about any that already fit — fire-and-forget so the
 * request isn't slowed. Idempotent via the match-notification ledger (shared
 * with the ride→Gesuch direction), so no rider is emailed twice for one ride.
 */

import { runMatchingForGesuch } from '../../../ride/matching-service';

declare const strapi: any;

function trigger(result: any): void {
  if (result?.id && result?.status === 'active') {
    void runMatchingForGesuch(strapi, result.id).catch((err: unknown) =>
      strapi.log.error(`[matching] gesuch ${result.id} run failed: ${err}`)
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
