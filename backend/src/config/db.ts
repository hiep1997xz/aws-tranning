import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env.js';
import * as schema from '../db/schema/index.js';

const pool = postgres(env.DATABASE_URL, { max: 10 });
export const db = drizzle(pool, { schema });
export const closeDb = async () => pool.end();
