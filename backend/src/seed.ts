/**
 * Dev seed — populates a fresh database with realistic test data.
 *
 * Trigger: SEED=true in environment AND NODE_ENV !== 'production'.
 * Guard: skips if any end-users already exist (the Strapi admin user
 *        doesn't count — it lives in admin_users, not up_users).
 *
 * Creates:
 *   - 3 users: approved driver, adult passenger, minor passenger
 *     (with parent contact)
 *   - 4 rides: one-off, weekly Tue/Thu commute, daily school run,
 *     flexible-origin
 *   - 2 bookings: one confirmed, one cancelled-by-passenger
 *   - 1 RideRequest with no match
 *
 * ID numbers are not stored (validate-and-discard, PLAN.md Q2), so the
 * seeded driver is force-approved directly via driver_status below.
 */

/** ISO datetime N days from now at given HH:MM (local). */
function inDays(days: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** YYYY-MM-DD N days from now. */
function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedDev(strapi: any): Promise<void> {
  // Don't seed twice.
  const existing = await strapi.db
    .query('plugin::users-permissions.user')
    .count();
  if (existing > 0) {
    strapi.log.info('[seed] Users already exist; skipping.');
    return;
  }

  strapi.log.info('[seed] Seeding dev data…');

  const authenticatedRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });
  if (!authenticatedRole) {
    strapi.log.warn('[seed] No "authenticated" role found; aborting.');
    return;
  }

  const userService = strapi.plugin('users-permissions').service('user');

  // ─── Users ──────────────────────────────────────────────────────
  // Driver: Anna. ID number isn't stored (validate-and-discard); she's
  // force-approved just below via driver_status.
  const driver = await userService.add({
    username: 'anna.driver',
    email: 'anna@seed.local',
    password: 'devpassword123',
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: authenticatedRole.id,
    first_name: 'Anna',
    last_name: 'Hahn',
    date_of_birth: '1985-04-12',
    mobile: '+4915112345678',
    postal_code: '21423',
    city: 'Winsen (Luhe)',
    street: 'Bahnhofstraße',
    house_number: '1',
    roles: ['driver'],
    driver_id_type: 'fuehrerschein',
  });

  // Force-approve the seeded driver so they can post rides without
  // going through the admin queue.
  await strapi.db.query('plugin::users-permissions.user').update({
    where: { id: driver.id },
    data: {
      driver_status: 'approved',
      driver_verified_at: new Date(),
    },
  });

  const passenger = await userService.add({
    username: 'bjorn.passenger',
    email: 'bjorn@seed.local',
    password: 'devpassword123',
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: authenticatedRole.id,
    first_name: 'Björn',
    last_name: 'Voss',
    date_of_birth: '1990-09-03',
    mobile: '+4915187654321',
    postal_code: '21423',
    city: 'Winsen (Luhe)',
    street: 'Marktplatz',
    house_number: '7',
    roles: ['passenger'],
  });

  const minor = await userService.add({
    username: 'clara.minor',
    email: 'clara@seed.local',
    password: 'devpassword123',
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: authenticatedRole.id,
    first_name: 'Clara',
    last_name: 'Hahn',
    date_of_birth: '2011-06-15',
    mobile: '+4915199998888',
    postal_code: '21423',
    city: 'Winsen (Luhe)',
    street: 'Bahnhofstraße',
    house_number: '1',
    parent_first_name: 'Anna',
    parent_last_name: 'Hahn',
    parent_mobile: '+4915112345678',
    roles: ['passenger'],
  });

  // ─── Rides ──────────────────────────────────────────────────────
  const rides = strapi.documents('api::ride.ride');

  // One-off: Winsen → Hamburg Hbf, day after tomorrow at 08:30
  await rides.create({
    data: {
      driver: driver.id,
      origin_address: 'Bahnhofstraße 1, 21423 Winsen (Luhe)',
      destination_address: 'Hamburg Hauptbahnhof',
      origin_lat: 53.357,
      origin_lng: 10.213,
      destination_lat: 53.553,
      destination_lng: 10.006,
      departure_at: inDays(2, 8, 30),
      seats_total: 3,
      recurrence: 'none',
      status: 'active',
    },
  });

  // Weekly Tue/Thu commute: Winsen → Lüneburg uni
  await rides.create({
    data: {
      driver: driver.id,
      origin_address: 'Bahnhofstraße 1, 21423 Winsen (Luhe)',
      destination_address: 'Universität Lüneburg',
      origin_lat: 53.357,
      origin_lng: 10.213,
      destination_lat: 53.245,
      destination_lng: 10.405,
      departure_at: inDays(3, 7, 45),
      return_at: inDays(3, 17, 30),
      seats_total: 4,
      recurrence: 'weekly',
      recurrence_weekdays: [2, 4],
      recurrence_until: dateInDays(180),
      status: 'active',
    },
  });

  // Daily school run
  await rides.create({
    data: {
      driver: driver.id,
      origin_address: 'Bahnhofstraße 1, 21423 Winsen (Luhe)',
      destination_address: 'Gymnasium Winsen',
      origin_lat: 53.357,
      origin_lng: 10.213,
      destination_lat: 53.358,
      destination_lng: 10.221,
      departure_at: inDays(1, 7, 30),
      seats_total: 4,
      recurrence: 'daily',
      recurrence_until: dateInDays(90),
      status: 'active',
    },
  });

  // Flexible-origin ride
  const flexRide = await rides.create({
    data: {
      driver: driver.id,
      origin_address: 'Winsen (Luhe), near train station',
      destination_address: 'Buxtehude Innenstadt',
      origin_lat: 53.357,
      origin_lng: 10.213,
      destination_lat: 53.475,
      destination_lng: 9.694,
      flexible_origin: true,
      departure_at: inDays(4, 9, 0),
      seats_total: 2,
      recurrence: 'none',
      status: 'active',
    },
  });

  // ─── Bookings ───────────────────────────────────────────────────
  const bookings = strapi.documents('api::booking.booking');

  await bookings.create({
    data: {
      ride: flexRide.documentId,
      passenger: passenger.id,
      booked_at: new Date().toISOString(),
      status: 'confirmed',
    },
  });

  await bookings.create({
    data: {
      ride: flexRide.documentId,
      passenger: minor.id,
      booked_at: new Date().toISOString(),
      status: 'cancelled_by_passenger',
    },
  });

  // ─── Unmatched RideRequest ──────────────────────────────────────
  const requests = strapi.documents('api::ride-request.ride-request');
  await requests.create({
    data: {
      passenger: passenger.id,
      origin_address: 'Winsen (Luhe)',
      destination_address: 'Stade Hauptbahnhof',
      origin_lat: 53.357,
      origin_lng: 10.213,
      destination_lat: 53.604,
      destination_lng: 9.476,
      departure_at: inDays(5, 8, 0),
      seats_needed: 1,
      recurrence: 'none',
      status: 'active',
    },
  });

  strapi.log.info(
    '[seed] Done — 3 users, 4 rides, 2 bookings, 1 ride-request created.'
  );
}
