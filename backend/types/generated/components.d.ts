import type { Schema, Struct } from '@strapi/strapi';

export interface GeoWaypoint extends Struct.ComponentSchema {
  collectionName: 'components_geo_waypoints';
  info: {
    description: "An ordered pick-up point along a ride's route (v2.0 Stage 1b).";
    displayName: 'Waypoint';
  };
  attributes: {
    address: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    lat: Schema.Attribute.Decimal & Schema.Attribute.Required;
    lng: Schema.Attribute.Decimal & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'geo.waypoint': GeoWaypoint;
    }
  }
}
