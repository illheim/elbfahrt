/**
 * users-permissions plugin extension entry point.
 *
 * No-op. Driver verification used to live here as a User lifecycle hook, but
 * under the validate-and-discard policy (PLAN.md Q2) the `driver_id_number` is
 * transient input that never reaches the database — so a DB lifecycle can't
 * see it. Validation now happens in `api::me.me.updateProfile`, the one place
 * that handles the transient number. Don't reintroduce a lifecycle hook here.
 */
export default (plugin: any) => plugin;
