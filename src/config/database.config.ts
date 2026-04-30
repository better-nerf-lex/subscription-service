import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { StripeEvent } from '../entities/stripe-event.entity';
import { TokenGrant } from '../entities/token-grant.entity';
import { TokenReservation } from '../entities/token-reservation.entity';
import { TokenReservationDebit } from '../entities/token-reservation-debit.entity';

const entities = [
  Subscription,
  StripeDetails,
  StripeEvent,
  TokenGrant,
  TokenReservation,
  TokenReservationDebit,
];

export const databaseConfig = registerAs('database', (): DataSourceOptions => {
  const isDbSslEnabled = process.env.DB_SSL === 'true';
  const dbSslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'gateway_user',
    password: process.env.DB_PASSWORD || 'gateway_password',
    database: process.env.DB_NAME || 'subscription_service',
    entities,
    migrations: ['dist/migrations/*.js'],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    ssl: isDbSslEnabled ? { rejectUnauthorized: dbSslRejectUnauthorized } : false,
    logging: process.env.NODE_ENV === 'development',
  };
});

// For TypeORM CLI
const isDbSslEnabled = process.env.DB_SSL === 'true';
const dbSslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'gateway_user',
  password: process.env.DB_PASSWORD || 'gateway_password',
  database: process.env.DB_NAME || 'subscription_service',
  entities,
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  ssl: isDbSslEnabled ? { rejectUnauthorized: dbSslRejectUnauthorized } : false,
});
