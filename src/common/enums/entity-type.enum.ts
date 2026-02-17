/**
 * EntityType represents the type of entity that owns a subscription
 * Can be a User, Team, or a Custom entity from the gateway service
 */
export enum EntityType {
  USER = 'user',
  TEAM = 'team',
  CUSTOM = 'custom',
}
