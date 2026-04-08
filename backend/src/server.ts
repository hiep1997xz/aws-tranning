import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import app from './app.js';
import { env } from './config/env.js';
import { db, closeDb } from './config/db.js';

const start = async () => {
  try {
    // Run pending migrations before accepting traffic
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    app.log.info('Database migrations applied');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await closeDb();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
