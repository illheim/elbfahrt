// import type { Core } from '@strapi/strapi';
import { seedDev } from './seed';

export default {
  /**
   * Runs before the application is initialized.
   * We hook the users-permissions plugin lifecycle for driver validation
   * in src/extensions/users-permissions/strapi-server.ts — nothing extra needed here.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * Runs after register and after content types are loaded.
   * We use it to seed dev data when SEED=true and we're not in production.
   */
  async bootstrap({ strapi }: { strapi: any }) {
    if (process.env.NODE_ENV === 'production') return;
    if (process.env.SEED !== 'true') return;
    await seedDev(strapi);
  },
};
